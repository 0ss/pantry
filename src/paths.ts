import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Inventory, PantryConfig } from "./types.js";

export const PANTRY_DIR = ".pantry";

export const DEFAULT_CONFIG: PantryConfig = {
  include: ["**/*.{ts,tsx,js,jsx}"],
  exclude: [],
  tokenBudget: 600,
  blockMode: "block",
  extraCapabilities: [],
};

/** Always-on excludes, on top of config + .gitignore. */
export const HARD_EXCLUDES = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/*.d.ts",
  "**/*.min.*",
  "**/.git/**",
  "**/.pantry/**",
];

export const MAX_FILE_SIZE = 500 * 1024;

export function pantryDir(root: string): string {
  return join(root, PANTRY_DIR);
}

export function ensurePantryDir(root: string): string {
  const dir = pantryDir(root);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function loadConfig(root: string): PantryConfig {
  try {
    const raw = readFileSync(join(pantryDir(root), "config.json"), "utf8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function loadInventory(root: string): Inventory | null {
  try {
    const raw = readFileSync(join(pantryDir(root), "inventory.json"), "utf8");
    return JSON.parse(raw) as Inventory;
  } catch {
    return null;
  }
}

export function saveInventory(root: string, inventory: Inventory): void {
  ensurePantryDir(root);
  writeFileSync(join(pantryDir(root), "inventory.json"), JSON.stringify(inventory, null, 1));
}

/** Fail-open error log. Never throws. */
export function logError(root: string, context: string, err: unknown): void {
  try {
    ensurePantryDir(root);
    const line = `${new Date().toISOString()} [${context}] ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`;
    appendFileSync(join(pantryDir(root), "errors.log"), line);
  } catch {
    // even the error log failing must not block anything
  }
}

/** Parse .gitignore into glob excludes. Simple patterns only. */
export function gitignoreGlobs(root: string): string[] {
  try {
    const raw = readFileSync(join(root, ".gitignore"), "utf8");
    const globs: string[] = [];
    for (let line of raw.split(/\r?\n/)) {
      line = line.trim();
      if (!line || line.startsWith("#") || line.startsWith("!")) continue;
      line = line.replace(/^\//, "").replace(/\/$/, "");
      if (!line) continue;
      // naive .gitignore translation, no negation or anchoring subtleties
      // subtleties; covers the dirs/extensions people actually ignore
      globs.push(
        line.includes("/") ? `${line}/**` : `**/${line}`,
        line.includes("/") ? line : `**/${line}/**`,
      );
    }
    return globs;
  } catch {
    return [];
  }
}

/** Walk up from cwd to find the repo root (dir with package.json or .git). */
export function findRepoRoot(from: string): string {
  let dir = from;
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, "package.json")) || existsSync(join(dir, ".git"))) return dir;
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return from;
}

export function isTestFile(file: string): boolean {
  return /\.(test|spec)\.[jt]sx?$|__tests__/.test(file);
}
