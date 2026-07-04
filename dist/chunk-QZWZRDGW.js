#!/usr/bin/env node

// src/paths.ts
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
var PANTRY_DIR = ".pantry";
var DEFAULT_CONFIG = {
  include: ["**/*.{ts,tsx,js,jsx}"],
  exclude: [],
  tokenBudget: 600,
  blockMode: "block",
  extraCapabilities: []
};
var HARD_EXCLUDES = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/*.d.ts",
  "**/*.min.*",
  "**/.git/**",
  "**/.pantry/**"
];
var MAX_FILE_SIZE = 500 * 1024;
function pantryDir(root) {
  return join(root, PANTRY_DIR);
}
function ensurePantryDir(root) {
  const dir = pantryDir(root);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}
function loadConfig(root) {
  try {
    const raw = readFileSync(join(pantryDir(root), "config.json"), "utf8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
function loadInventory(root) {
  try {
    const raw = readFileSync(join(pantryDir(root), "inventory.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function saveInventory(root, inventory) {
  ensurePantryDir(root);
  writeFileSync(join(pantryDir(root), "inventory.json"), JSON.stringify(inventory, null, 1));
}
function logError(root, context, err) {
  try {
    ensurePantryDir(root);
    const line = `${(/* @__PURE__ */ new Date()).toISOString()} [${context}] ${err instanceof Error ? err.stack ?? err.message : String(err)}
`;
    appendFileSync(join(pantryDir(root), "errors.log"), line);
  } catch {
  }
}
function gitignoreGlobs(root) {
  try {
    const raw = readFileSync(join(root, ".gitignore"), "utf8");
    const globs = [];
    for (let line of raw.split(/\r?\n/)) {
      line = line.trim();
      if (!line || line.startsWith("#") || line.startsWith("!")) continue;
      line = line.replace(/^\//, "").replace(/\/$/, "");
      if (!line) continue;
      globs.push(
        line.includes("/") ? `${line}/**` : `**/${line}`,
        line.includes("/") ? line : `**/${line}/**`
      );
    }
    return globs;
  } catch {
    return [];
  }
}
function findRepoRoot(from) {
  let dir = from;
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, "package.json")) || existsSync(join(dir, ".git"))) return dir;
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return from;
}
function isTestFile(file) {
  return /\.(test|spec)\.[jt]sx?$|__tests__/.test(file);
}

export {
  DEFAULT_CONFIG,
  HARD_EXCLUDES,
  MAX_FILE_SIZE,
  pantryDir,
  ensurePantryDir,
  loadConfig,
  loadInventory,
  saveInventory,
  logError,
  gitignoreGlobs,
  findRepoRoot,
  isTestFile
};
