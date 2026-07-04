import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensurePantryDir, pantryDir } from "../paths.js";
import type { FileScan } from "./source.js";

const CACHE_VERSION = 1;

export interface CacheEntry {
  mtimeMs: number;
  size: number;
  scan: FileScan;
}

export interface ScanCache {
  version: number;
  files: Record<string, CacheEntry>;
}

export function loadCache(root: string): ScanCache {
  try {
    const raw = readFileSync(join(pantryDir(root), "cache.json"), "utf8");
    const cache = JSON.parse(raw) as ScanCache;
    if (cache.version === CACHE_VERSION && cache.files) return cache;
  } catch {
    // missing or stale-format cache — cold scan
  }
  return { version: CACHE_VERSION, files: {} };
}

export function saveCache(root: string, cache: ScanCache): void {
  try {
    ensurePantryDir(root);
    writeFileSync(join(pantryDir(root), "cache.json"), JSON.stringify(cache));
  } catch {
    // cache write failure only costs the next scan some time
  }
}
