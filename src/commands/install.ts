import { existsSync } from "node:fs";
import { join } from "node:path";
import { installClaudeCode } from "../adapters/claude-code.js";

export async function install(root: string, target: string): Promise<number> {
  if (target !== "claude-code") {
    console.error(target ? `Unknown target: ${target}` : "Missing target.");
    console.error("Supported: pantry install claude-code");
    console.error(
      "(Cursor and AGENTS.md get instruction files — see the adapters/ dir in the repo.)",
    );
    return 1;
  }
  if (!existsSync(join(root, ".pantry", "inventory.json"))) {
    console.error(
      "No inventory yet — run `pantry init` first so the hooks have something to answer from.",
    );
    return 1;
  }
  console.log("🥫 Wiring up Claude Code…\n");
  const report = installClaudeCode(root);
  for (const line of report.lines) console.log(`  ${line}`);
  console.log("\nDone. New sessions get the pantry summary; installs get bounced at the door.");
  console.log("Undo anytime: pantry uninstall claude-code");
  return 0;
}
