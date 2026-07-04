import { uninstallClaudeCode } from "../adapters/claude-code.js";

export async function uninstall(root: string, target: string): Promise<number> {
  if (target !== "claude-code") {
    console.error(target ? `Unknown target: ${target}` : "Missing target.");
    console.error("Supported: pantry uninstall claude-code");
    return 1;
  }
  console.log("🥫 Unwiring Claude Code…\n");
  const report = uninstallClaudeCode(root);
  for (const line of report.lines) console.log(`  ${line}`);
  console.log("\nThe .pantry/ directory itself is yours — delete it if you're done with pantry.");
  return 0;
}
