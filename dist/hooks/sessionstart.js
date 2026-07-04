#!/usr/bin/env node
import {
  findRepoRoot
} from "../chunk-QZWZRDGW.js";
import "../chunk-FYS2JH42.js";

// src/hooks/sessionstart.ts
import { existsSync, readFileSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
async function main() {
  try {
    const root = findRepoRoot(process.cwd());
    const inventoryPath = join(root, ".pantry", "inventory.json");
    const summaryPath = join(root, ".pantry", "PANTRY.md");
    if (!existsSync(inventoryPath)) {
      if (!existsSync(join(root, "package.json"))) return;
      const { init } = await import("../init-FXK6TDEF.js");
      await init(root, { quiet: true });
    } else if (isStale(root, inventoryPath)) {
      const { sync } = await import("../sync-JWCSUVEK.js");
      await sync(root, { quiet: true });
    }
    if (!existsSync(summaryPath)) return;
    const summary = readFileSync(summaryPath, "utf8");
    const cliPath = join(dirname(fileURLToPath(import.meta.url)), "..", "cli.js");
    const checkCmd = existsSync(cliPath) ? `node "${cliPath}"` : "pantry";
    process.stdout.write(`${summary}

`);
    process.stdout.write(
      `Pantry command for this session (also aliased as \`pantry\` if installed):
  ${checkCmd} check "<need>"
Run it before creating components/hooks/utils/schemas or adding dependencies.
`
    );
  } catch {
  }
}
function isStale(root, inventoryPath) {
  try {
    return statSync(join(root, "package.json")).mtimeMs > statSync(inventoryPath).mtimeMs;
  } catch {
    return false;
  }
}
await main();
