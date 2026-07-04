#!/usr/bin/env node
import {
  installClaudeCode
} from "./chunk-DGGLPQD2.js";
import "./chunk-QZWZRDGW.js";
import "./chunk-FYS2JH42.js";

// src/commands/install.ts
import { existsSync } from "fs";
import { join } from "path";
async function install(root, target) {
  if (target !== "claude-code") {
    console.error(target ? `Unknown target: ${target}` : "Missing target.");
    console.error("Supported: pantry install claude-code");
    console.error(
      "(Cursor and AGENTS.md get instruction files \u2014 see the adapters/ dir in the repo.)"
    );
    return 1;
  }
  if (!existsSync(join(root, ".pantry", "inventory.json"))) {
    console.error(
      "No inventory yet \u2014 run `pantry init` first so the hooks have something to answer from."
    );
    return 1;
  }
  console.log("\u{1F96B} Wiring up Claude Code\u2026\n");
  const report = installClaudeCode(root);
  for (const line of report.lines) console.log(`  ${line}`);
  console.log("\nDone. New sessions get the pantry summary; installs get bounced at the door.");
  console.log("Undo anytime: pantry uninstall claude-code");
  return 0;
}
export {
  install
};
