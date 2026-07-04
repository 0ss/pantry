import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { glob } from "tinyglobby";
import { loadFamilies } from "../capabilities/match.js";
import { HARD_EXCLUDES, MAX_FILE_SIZE, gitignoreGlobs, isTestFile, loadConfig } from "../paths.js";
import { type ScanCache, loadCache, saveCache } from "../scanner/cache.js";
import { scanDeps } from "../scanner/deps.js";
import { type FileScan, loadParser, scanSource } from "../scanner/source.js";
import { countUsage, loadPathAliases, resolveSpecifier } from "../scanner/usage.js";
import type { Inventory, InventoryEntry } from "../types.js";

export interface BuildResult {
  inventory: Inventory;
  /** How many files were re-parsed (vs served from cache). */
  parsedCount: number;
}

/** Full inventory build. Incremental when a warm cache exists. */
export async function buildInventory(root: string): Promise<BuildResult> {
  const config = loadConfig(root);
  const families = loadFamilies(root);

  // no parser (plugin running without node_modules) → deps-only inventory.
  // The install-bouncer still has everything it needs.
  const hasParser = await loadParser();

  const files = hasParser
    ? await glob(config.include, {
        cwd: root,
        ignore: [...HARD_EXCLUDES, ...config.exclude, ...gitignoreGlobs(root)],
        followSymbolicLinks: false,
        onlyFiles: true,
      })
    : [];
  files.sort();

  const cache = loadCache(root);
  const nextCache: ScanCache = { version: cache.version, files: {} };
  const scans: FileScan[] = [];
  let parseErrorCount = 0;
  let parsedCount = 0;
  const hashInput: string[] = [];

  for (const file of files) {
    const abs = join(root, file);
    let mtimeMs: number;
    let size: number;
    try {
      const stat = statSync(abs);
      mtimeMs = stat.mtimeMs;
      size = stat.size;
    } catch {
      continue; // vanished between glob and stat
    }
    if (size > MAX_FILE_SIZE) continue;
    hashInput.push(`${file}:${mtimeMs}:${size}`);

    const cached = cache.files[file];
    let scan: FileScan;
    if (cached && cached.mtimeMs === mtimeMs && cached.size === size) {
      scan = cached.scan;
    } else {
      let source: string;
      try {
        source = readFileSync(abs, "utf8");
      } catch {
        continue;
      }
      scan = scanSource(file, source);
      parsedCount++;
    }
    if (scan.parseError) parseErrorCount++;
    nextCache.files[file] = { mtimeMs, size, scan };
    scans.push(scan);
  }

  const aliases = loadPathAliases(root);
  const usage = countUsage(scans, aliases);

  // deps + usage counts
  const deps = scanDeps(root, families);
  for (const dep of deps) {
    dep.usageCount = usage.depCounts.get(dep.name)?.size ?? 0;
  }
  try {
    const pkgStat = statSync(join(root, "package.json"));
    hashInput.push(`package.json:${pkgStat.mtimeMs}:${pkgStat.size}`);
  } catch {
    // source-only repo
  }

  // shadcn-style repos have no ui-kit dep, just a components/ui/ dir — that
  // still counts as "we have a UI kit at home"
  if (!deps.some((d) => d.family === "ui-kit")) {
    const uiFiles = scans.filter((s) => /(^|\/)components\/ui\//.test(s.file));
    if (uiFiles.length > 0) {
      const importers = new Set<string>();
      for (const f of uiFiles) {
        for (const perName of usage.counts.get(f.file)?.values() ?? []) {
          for (const imp of perName.files) importers.add(imp);
        }
      }
      deps.push({
        name: "components/ui (shadcn-style)",
        version: "local",
        family: "ui-kit",
        usageCount: importers.size,
        dev: false,
      });
    }
  }

  // barrel attribution: entries re-exported by an index file get exportedFrom
  const fileSet = new Set(scans.map((s) => s.file));
  const scanByFile = new Map(scans.map((s) => [s.file, s]));
  const barrelOf = new Map<string, string>(); // "file#name" → barrel file
  for (const scan of scans) {
    for (const re of scan.reexports) {
      const under = resolveSpecifier(re.specifier, scan.file, fileSet, aliases);
      if (!under) continue;
      const underScan = scanByFile.get(under);
      if (!underScan) continue;
      const names = re.names === "all" ? underScan.exports.map((e) => e.name) : re.names;
      for (const name of names) barrelOf.set(`${under}#${name}`, scan.file);
    }
  }

  const entries: InventoryEntry[] = [];
  for (const scan of scans) {
    if (isTestFile(scan.file)) continue; // test-file exports aren't reusables
    const fileUsage = usage.counts.get(scan.file);
    for (const exp of scan.exports) {
      const u = fileUsage?.get(exp.isDefault ? "default" : exp.name);
      const barrel = barrelOf.get(`${scan.file}#${exp.name}`);
      entries.push({
        name: exp.name,
        kind: exp.kind,
        file: scan.file,
        line: exp.line,
        signature: exp.signature,
        doc: exp.doc,
        usageCount: (u?.files.size ?? 0) + (u?.testFiles.size ?? 0),
        testUsageCount: u?.testFiles.size ?? 0,
        topImporters: [...(u?.files ?? []), ...(u?.testFiles ?? [])].sort().slice(0, 3),
        ...(barrel ? { exportedFrom: barrel } : {}),
      });
    }
  }
  entries.sort(
    (a, b) =>
      b.usageCount - a.usageCount || a.file.localeCompare(b.file) || a.name.localeCompare(b.name),
  );

  const inventory: Inventory = {
    entries,
    deps,
    meta: {
      scannedAt: new Date().toISOString(),
      fileCount: scans.length,
      hashOfInputs: createHash("sha256").update(hashInput.join("\n")).digest("hex").slice(0, 16),
      parseErrorCount,
      unresolvedImportCount: usage.unresolvedImportCount,
    },
  };

  saveCache(root, nextCache);
  return { inventory, parsedCount };
}
