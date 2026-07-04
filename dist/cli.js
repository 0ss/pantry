#!/usr/bin/env node
import {
  require_picocolors
} from "./chunk-COWW6QSR.js";
import {
  findRepoRoot,
  logError
} from "./chunk-QZWZRDGW.js";
import {
  MalformedPackageJsonError
} from "./chunk-ZACRB6CS.js";
import "./chunk-DID37CC6.js";
import {
  __toESM
} from "./chunk-FYS2JH42.js";

// src/cli.ts
var import_picocolors = __toESM(require_picocolors(), 1);
var USAGE = `\u{1F96B} pantry \u2014 check the pantry before shopping

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
function parseArgs(argv) {
  const [command = "", ...rest] = argv;
  const positional = [];
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      const next = rest[i + 1];
      if (VALUE_FLAGS.has(name) && next !== void 0 && !next.startsWith("--")) {
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
var VALUE_FLAGS = /* @__PURE__ */ new Set(["top", "reason"]);
async function main() {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));
  const root = findRepoRoot(process.cwd());
  switch (command) {
    case "init": {
      const { init } = await import("./init-FXK6TDEF.js");
      return init(root, { quiet: Boolean(flags.quiet) });
    }
    case "sync": {
      const { sync } = await import("./sync-JWCSUVEK.js");
      return sync(root, { quiet: Boolean(flags.quiet) });
    }
    case "check": {
      const { check } = await import("./check-EFTWPVDC.js");
      const need = positional.join(" ");
      if (!need) {
        console.error('pantry check needs a need. Try: pantry check "date formatting"');
        return 1;
      }
      return check(root, need, {
        json: Boolean(flags.json),
        plain: Boolean(flags.plain),
        top: flags.top ? Number(flags.top) : 5
      });
    }
    case "audit": {
      const { audit } = await import("./audit-QDHGP6EJ.js");
      return audit(root, { json: Boolean(flags.json), strict: Boolean(flags.strict) });
    }
    case "allow": {
      const { allow } = await import("./allow-LPG3OYEA.js");
      const pkg = positional[0];
      if (!pkg) {
        console.error(
          'pantry allow needs a package. Try: pantry allow moment --reason "legacy code"'
        );
        return 1;
      }
      return allow(root, pkg, typeof flags.reason === "string" ? flags.reason : "");
    }
    case "stats": {
      const { stats } = await import("./stats-V6SJXWZE.js");
      return stats(root, { json: Boolean(flags.json) });
    }
    case "doctor": {
      const { doctor } = await import("./doctor-ZAN2ONMZ.js");
      return doctor(root);
    }
    case "install": {
      const { install } = await import("./install-27TBU53I.js");
      return install(root, positional[0] ?? "");
    }
    case "uninstall": {
      const { uninstall } = await import("./uninstall-EHERG7JQ.js");
      return uninstall(root, positional[0] ?? "");
    }
    case "hook": {
      try {
        if (positional[0] === "pretooluse") await import("./hooks/pretooluse.js");
        else if (positional[0] === "sessionstart") await import("./hooks/sessionstart.js");
      } catch {
        return 0;
      }
      return process.exitCode ?? 0;
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
      const { readFileSync } = await import("fs");
      const { join, dirname } = await import("path");
      const { fileURLToPath } = await import("url");
      try {
        const here = dirname(fileURLToPath(import.meta.url));
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
main().then((code) => {
  process.exitCode = code;
}).catch((err) => {
  if (err instanceof MalformedPackageJsonError) {
    console.error(import_picocolors.default.red(`Could not parse ${err.file}.`));
    console.error("Fix the JSON syntax and re-run.");
    process.exitCode = 1;
    return;
  }
  console.error(
    import_picocolors.default.red(`pantry hit an internal error: ${err instanceof Error ? err.message : String(err)}`)
  );
  console.error("Details logged to .pantry/errors.log \u2014 please open an issue.");
  try {
    logError(findRepoRoot(process.cwd()), "cli", err);
  } catch {
  }
  process.exitCode = 1;
});
export {
  parseArgs
};
