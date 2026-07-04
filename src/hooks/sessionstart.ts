// SessionStart hook: make sure the pantry is stocked, then print PANTRY.md.
// stdout becomes hidden session context for the agent.
//
// Zero-config path: plugin installed, session opens in a JS/TS repo with no
// .pantry yet → we scan right here (the scanner does ~1k files in ~150ms)
// so the bouncer and the summary work from minute one.
//
// Anything goes wrong → say nothing, exit 0. Never wreck a session start.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findRepoRoot } from "../paths.js";

async function main(): Promise<void> {
  try {
    const root = findRepoRoot(process.cwd());
    const inventoryPath = join(root, ".pantry", "inventory.json");
    const summaryPath = join(root, ".pantry", "PANTRY.md");

    // only auto-init where it makes sense: an actual JS/TS project
    if (!existsSync(inventoryPath)) {
      if (!existsSync(join(root, "package.json"))) return;
      const { init } = await import("../commands/init.js");
      await init(root, { quiet: true });
    } else if (isStale(root, inventoryPath)) {
      const { sync } = await import("../commands/sync.js");
      await sync(root, { quiet: true });
    }

    if (!existsSync(summaryPath)) return;
    const summary = readFileSync(summaryPath, "utf8");

    // tell the agent exactly how to run checks, wherever this plugin lives
    const cliPath = join(dirname(fileURLToPath(import.meta.url)), "..", "cli.js");
    const checkCmd = existsSync(cliPath) ? `node "${cliPath}"` : "pantry";

    process.stdout.write(`${summary}\n\n`);
    process.stdout.write(
      `Pantry command for this session (also aliased as \`pantry\` if installed):\n  ${checkCmd} check "<need>"\nRun it before creating components/hooks/utils/schemas or adding dependencies.\n`,
    );
  } catch {
    // no pantry here, nothing to say
  }
}

function isStale(root: string, inventoryPath: string): boolean {
  try {
    return statSync(join(root, "package.json")).mtimeMs > statSync(inventoryPath).mtimeMs;
  } catch {
    return false;
  }
}

await main();
