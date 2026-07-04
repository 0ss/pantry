// SubagentStart: subagents write a lot of the actual code, and they don't
// inherit the main session's context — so they'd shop blind without this.
// Same PANTRY.md, delivered as additionalContext JSON.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "../paths.js";

try {
  const root = findRepoRoot(process.cwd());
  const summaryPath = join(root, ".pantry", "PANTRY.md");
  if (existsSync(summaryPath)) {
    const summary = readFileSync(summaryPath, "utf8");
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: { hookEventName: "SubagentStart", additionalContext: summary },
      })}\n`,
    );
  }
} catch {
  // quiet — a subagent without pantry context still works
}
