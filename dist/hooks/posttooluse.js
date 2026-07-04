#!/usr/bin/env node
import {
  findRepoRoot,
  isTestFile,
  loadInventory
} from "../chunk-QZWZRDGW.js";
import "../chunk-FYS2JH42.js";

// src/hooks/posttooluse.ts
import { readFileSync, realpathSync } from "fs";
var EXPORT_RE = /export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;
try {
  const input = readFileSync(0, "utf8").replace(/^﻿/, "");
  const payload = JSON.parse(input);
  const toolName = payload?.tool_name ?? "";
  if (toolName !== "Write" && toolName !== "Edit") process.exit(0);
  const filePath = payload?.tool_input?.file_path ?? "";
  if (!/\.[jt]sx?$/.test(filePath) || isTestFile(filePath)) process.exit(0);
  const newContent = toolName === "Write" ? payload?.tool_input?.content ?? "" : payload?.tool_input?.new_string ?? "";
  if (!newContent.includes("export")) process.exit(0);
  const root = findRepoRoot(process.cwd());
  const inventory = loadInventory(root);
  if (!inventory) process.exit(0);
  const realRoot = safeReal(root);
  const realFile = safeReal(filePath);
  const rel = realFile.startsWith(realRoot) ? realFile.slice(realRoot.length + 1) : realFile;
  const warnings = [];
  const seen = /* @__PURE__ */ new Set();
  for (const match of newContent.matchAll(EXPORT_RE)) {
    const name = match[1];
    if (seen.has(name)) continue;
    seen.add(name);
    const existing = inventory.entries.filter(
      (e) => e.name === name && e.file !== rel && e.kind !== "type" && e.kind !== "constant"
    ).sort((a, b) => b.usageCount - a.usageCount)[0];
    if (existing) {
      const uses = existing.usageCount > 0 ? `, used in ${existing.usageCount} file${existing.usageCount === 1 ? "" : "s"}` : "";
      warnings.push(
        `${name} already exists at ${existing.file}:${existing.line} (${existing.kind}${uses})`
      );
    }
  }
  if (warnings.length > 0) {
    const context = [
      `\u{1F96B} Pantry: you just defined ${warnings.length === 1 ? "an export that" : "exports that"} already exist${warnings.length === 1 ? "s" : ""} in this repo:`,
      ...warnings.map((w) => `  - ${w}`),
      `Import the existing one instead unless this duplication is deliberate. Run pantry check for details.`
    ].join("\n");
    process.stdout.write(
      `${JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: context } })}
`
    );
  }
} catch {
}
process.exit(0);
function safeReal(path) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}
