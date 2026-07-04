#!/usr/bin/env node
import {
  uninstallClaudeCode
} from "./chunk-DGGLPQD2.js";
import "./chunk-QZWZRDGW.js";
import "./chunk-FYS2JH42.js";

// src/commands/uninstall.ts
async function uninstall(root, target) {
  if (target !== "claude-code") {
    console.error(target ? `Unknown target: ${target}` : "Missing target.");
    console.error("Supported: pantry uninstall claude-code");
    return 1;
  }
  console.log("\u{1F96B} Unwiring Claude Code\u2026\n");
  const report = uninstallClaudeCode(root);
  for (const line of report.lines) console.log(`  ${line}`);
  console.log("\nThe .pantry/ directory itself is yours \u2014 delete it if you're done with pantry.");
  return 0;
}
export {
  uninstall
};
