// PostToolUse duplicate-export detector. The bouncer catches duplicate
// *installs*; this catches duplicate *code* the moment the agent writes it.
//
// Watches Write/Edit results for newly defined exports whose name already
// exists elsewhere in the inventory, and feeds the agent a heads-up as
// additionalContext. Advisory only — the write already happened, we just
// make sure the agent knows what it duplicated while it can still fix it.
//
// No parser here (plugins run without node_modules) — a regex over the new
// content is plenty for name-collision detection. Fail open, always exit 0.

import { readFileSync, realpathSync } from "node:fs";
import { findRepoRoot, isTestFile, loadInventory } from "../paths.js";

const EXPORT_RE =
  /export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;

try {
  const input = readFileSync(0, "utf8").replace(/^﻿/, "");
  const payload = JSON.parse(input);
  const toolName: string = payload?.tool_name ?? "";
  if (toolName !== "Write" && toolName !== "Edit") process.exit(0);

  const filePath: string = payload?.tool_input?.file_path ?? "";
  if (!/\.[jt]sx?$/.test(filePath) || isTestFile(filePath)) process.exit(0);

  const newContent: string =
    toolName === "Write"
      ? (payload?.tool_input?.content ?? "")
      : (payload?.tool_input?.new_string ?? "");
  if (!newContent.includes("export")) process.exit(0);

  const root = findRepoRoot(process.cwd());
  const inventory = loadInventory(root);
  if (!inventory) process.exit(0);

  // repo-relative form of the file being written, for self-comparison.
  // realpath both sides — macOS hands out /var/... and /private/var/...
  // for the same directory depending on who you ask
  const realRoot = safeReal(root);
  const realFile = safeReal(filePath);
  const rel = realFile.startsWith(realRoot) ? realFile.slice(realRoot.length + 1) : realFile;

  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const match of newContent.matchAll(EXPORT_RE)) {
    const name = match[1] as string;
    if (seen.has(name)) continue;
    seen.add(name);
    const existing = inventory.entries
      .filter(
        (e) => e.name === name && e.file !== rel && e.kind !== "type" && e.kind !== "constant",
      )
      .sort((a, b) => b.usageCount - a.usageCount)[0];
    if (existing) {
      const uses =
        existing.usageCount > 0
          ? `, used in ${existing.usageCount} file${existing.usageCount === 1 ? "" : "s"}`
          : "";
      warnings.push(
        `${name} already exists at ${existing.file}:${existing.line} (${existing.kind}${uses})`,
      );
    }
  }

  if (warnings.length > 0) {
    const context = [
      `🥫 Pantry: you just defined ${warnings.length === 1 ? "an export that" : "exports that"} already exist${warnings.length === 1 ? "s" : ""} in this repo:`,
      ...warnings.map((w) => `  - ${w}`),
      `Import the existing one instead unless this duplication is deliberate. Run pantry check for details.`,
    ].join("\n");
    process.stdout.write(
      `${JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: context } })}\n`,
    );
  }
} catch {
  // advisory hook — nothing here is worth interrupting a session for
}
process.exit(0);

function safeReal(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path; // file may not exist yet (Write to a new path) — fine
  }
}
