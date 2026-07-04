import pc from "picocolors";
import { findRepoRoot, logError } from "./paths.js";
import { MalformedPackageJsonError } from "./scanner/deps.js";

const USAGE = `🥫 pantry — check the pantry before shopping

Usage: pantry <command> [args]

  init                      scan the repo, stock the pantry
  check "<need>"            what do we already have for this?
  audit                     duplicate deps, duplicate code, native equivalents
  sync                      incremental re-index
  install claude-code       wire up hooks + skill for Claude Code
  uninstall claude-code     restore everything the installer touched
  allow <pkg> --reason ""   permit a deliberate duplicate (audit trail)
  stats                     blocks, checks, top reused modules
  doctor                    is everything wired and fresh?

Flags: --json  --plain  --top <n>  --strict  --quiet
`;

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

/** Hand-rolled arg parsing: `--flag`, `--flag value`, positionals. */
export function parseArgs(argv: string[]): ParsedArgs {
  const [command = "", ...rest] = argv;
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i] as string;
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      const next = rest[i + 1];
      if (VALUE_FLAGS.has(name) && next !== undefined && !next.startsWith("--")) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { command, positional, flags };
}

const VALUE_FLAGS = new Set(["top", "reason"]);

async function main(): Promise<number> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));
  const root = findRepoRoot(process.cwd());

  switch (command) {
    case "init": {
      const { init } = await import("./commands/init.js");
      return init(root, { quiet: Boolean(flags.quiet) });
    }
    case "sync": {
      const { sync } = await import("./commands/sync.js");
      return sync(root, { quiet: Boolean(flags.quiet) });
    }
    case "check": {
      const { check } = await import("./commands/check.js");
      const need = positional.join(" ");
      if (!need) {
        console.error('pantry check needs a need. Try: pantry check "date formatting"');
        return 1;
      }
      return check(root, need, {
        json: Boolean(flags.json),
        plain: Boolean(flags.plain),
        top: flags.top ? Number(flags.top) : 5,
      });
    }
    case "audit": {
      const { audit } = await import("./commands/audit.js");
      return audit(root, { json: Boolean(flags.json), strict: Boolean(flags.strict) });
    }
    case "allow": {
      const { allow } = await import("./commands/allow.js");
      const pkg = positional[0];
      if (!pkg) {
        console.error(
          'pantry allow needs a package. Try: pantry allow moment --reason "legacy code"',
        );
        return 1;
      }
      return allow(root, pkg, typeof flags.reason === "string" ? flags.reason : "");
    }
    case "stats": {
      const { stats } = await import("./commands/stats.js");
      return stats(root, { json: Boolean(flags.json) });
    }
    case "doctor": {
      const { doctor } = await import("./commands/doctor.js");
      return doctor(root);
    }
    case "install": {
      const { install } = await import("./commands/install.js");
      return install(root, positional[0] ?? "");
    }
    case "uninstall": {
      const { uninstall } = await import("./commands/uninstall.js");
      return uninstall(root, positional[0] ?? "");
    }
    case "hook": {
      // internal: what the Claude Code hook entries actually invoke.
      // fail open on anything unexpected — never break someone's session.
      try {
        if (positional[0] === "pretooluse") await import("./hooks/pretooluse.js");
        else if (positional[0] === "sessionstart") await import("./hooks/sessionstart.js");
      } catch {
        return 0;
      }
      return (process.exitCode as number | undefined) ?? 0;
    }
    case "":
    case "help":
    case "--help":
    case "-h":
      console.log(USAGE);
      return 0;
    case "--version":
    case "-v":
    case "version": {
      const { readFileSync } = await import("node:fs");
      const { join, dirname } = await import("node:path");
      const { fileURLToPath } = await import("node:url");
      try {
        const here = dirname(fileURLToPath(import.meta.url));
        // dist/cli.js → ../package.json ; src/cli.ts in dev → ../package.json
        const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8"));
        console.log(pkg.version);
      } catch {
        console.log("unknown");
      }
      return 0;
    }
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run `pantry help` for the command list.");
      return 1;
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    if (err instanceof MalformedPackageJsonError) {
      console.error(pc.red(`Could not parse ${err.file}.`));
      console.error("Fix the JSON syntax and re-run.");
      process.exitCode = 1;
      return;
    }
    console.error(
      pc.red(`pantry hit an internal error: ${err instanceof Error ? err.message : String(err)}`),
    );
    console.error("Details logged to .pantry/errors.log — please open an issue.");
    try {
      logError(findRepoRoot(process.cwd()), "cli", err);
    } catch {
      // nothing else to do
    }
    process.exitCode = 1;
  });
