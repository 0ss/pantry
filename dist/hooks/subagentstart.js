#!/usr/bin/env node
import {
  findRepoRoot
} from "../chunk-QZWZRDGW.js";
import "../chunk-FYS2JH42.js";

// src/hooks/subagentstart.ts
import { existsSync, readFileSync } from "fs";
import { join } from "path";
try {
  const root = findRepoRoot(process.cwd());
  const summaryPath = join(root, ".pantry", "PANTRY.md");
  if (existsSync(summaryPath)) {
    const summary = readFileSync(summaryPath, "utf8");
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: { hookEventName: "SubagentStart", additionalContext: summary }
      })}
`
    );
  }
} catch {
}
