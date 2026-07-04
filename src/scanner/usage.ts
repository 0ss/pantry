import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isTestFile } from "../paths.js";
import type { FileScan } from "./source.js";

export interface UsageResult {
  /** file → exportName → distinct importer files. */
  counts: Map<string, Map<string, { files: Set<string>; testFiles: Set<string> }>>;
  /** package name → distinct importer files. */
  depCounts: Map<string, Set<string>>;
  unresolvedImportCount: number;
}

interface PathAlias {
  prefix: string; // "@/" for "@/*"
  target: string; // "src/" for "./src/*"
}

const RESOLVE_EXTENSIONS = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx",
];

/**
 * Build the import graph across scanned files and count usages per export.
 * Namespace/dynamic imports count as one usage of every export in the target
 * file — reachable, if not provably referenced.
 */
export function countUsage(scans: FileScan[], aliases: PathAlias[]): UsageResult {
  const fileSet = new Set(scans.map((s) => s.file));
  const scanByFile = new Map(scans.map((s) => [s.file, s]));
  const counts: UsageResult["counts"] = new Map();
  const depCounts = new Map<string, Set<string>>();
  let unresolvedImportCount = 0;

  const bump = (file: string, name: string, importer: string) => {
    let perFile = counts.get(file);
    if (!perFile) {
      perFile = new Map();
      counts.set(file, perFile);
    }
    let entry = perFile.get(name);
    if (!entry) {
      entry = { files: new Set(), testFiles: new Set() };
      perFile.set(name, entry);
    }
    (isTestFile(importer) ? entry.testFiles : entry.files).add(importer);
  };

  /** Resolve an imported name against a file, following one barrel level. */
  const bumpResolved = (targetFile: string, name: string, importer: string, depth: number) => {
    const target = scanByFile.get(targetFile);
    if (!target) return;
    const direct = target.exports.some((e) => (name === "default" ? e.isDefault : e.name === name));
    if (direct || depth > 0) {
      bump(targetFile, name, importer);
      return;
    }
    // not exported directly — maybe re-exported from a barrel
    for (const re of target.reexports) {
      if (re.names === "all" || re.names.includes(name)) {
        const under = resolveSpecifier(re.specifier, targetFile, fileSet, aliases);
        if (under) {
          const underScan = scanByFile.get(under);
          if (underScan?.exports.some((e) => e.name === name)) {
            bump(under, name, importer);
            return;
          }
        }
      }
    }
    bump(targetFile, name, importer); // unknown name — attribute to the barrel itself
  };

  for (const scan of scans) {
    for (const imp of scan.imports) {
      if (
        !imp.specifier.startsWith(".") &&
        !imp.specifier.startsWith("/") &&
        !isAliased(imp.specifier, aliases)
      ) {
        // bare specifier → package usage
        const pkg = packageNameOf(imp.specifier);
        if (pkg) {
          let set = depCounts.get(pkg);
          if (!set) {
            set = new Set();
            depCounts.set(pkg, set);
          }
          set.add(scan.file);
        }
        continue;
      }
      const resolved = resolveSpecifier(imp.specifier, scan.file, fileSet, aliases);
      if (!resolved) {
        unresolvedImportCount++;
        continue;
      }
      if (imp.namespace || imp.names.length === 0) {
        // namespace, dynamic, or side-effect import: everything is reachable
        const target = scanByFile.get(resolved);
        if (target)
          for (const e of target.exports)
            bump(resolved, e.isDefault ? "default" : e.name, scan.file);
      } else {
        for (const name of imp.names) bumpResolved(resolved, name, scan.file, 0);
      }
    }
  }

  return { counts, depCounts, unresolvedImportCount };
}

function isAliased(specifier: string, aliases: PathAlias[]): boolean {
  return aliases.some((a) => specifier.startsWith(a.prefix));
}

/** "@scope/pkg/sub" → "@scope/pkg"; "pkg/sub" → "pkg". */
export function packageNameOf(specifier: string): string | null {
  if (specifier.startsWith("node:")) return null;
  const parts = specifier.split("/");
  if (specifier.startsWith("@")) return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  return parts[0] || null;
}

/** Resolve a relative or aliased specifier to a repo-relative file, or null. */
export function resolveSpecifier(
  specifier: string,
  importerFile: string,
  fileSet: Set<string>,
  aliases: PathAlias[],
): string | null {
  let base: string;
  if (specifier.startsWith(".")) {
    const dir = importerFile.split("/").slice(0, -1).join("/");
    base = normalizePath(dir ? `${dir}/${specifier}` : specifier);
  } else {
    const alias = aliases.find((a) => specifier.startsWith(a.prefix));
    if (!alias) return null;
    base = normalizePath(alias.target + specifier.slice(alias.prefix.length));
  }
  // strip explicit .js/.jsx in favor of the on-disk .ts/.tsx (NodeNext style)
  const variants = [base, base.replace(/\.[jt]sx?$/, "")];
  for (const v of variants) {
    for (const ext of RESOLVE_EXTENSIONS) {
      if (fileSet.has(v + ext)) return v + ext;
    }
  }
  return null;
}

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

/** Read tsconfig.json paths into prefix aliases. Prefix patterns only. */
export function loadPathAliases(root: string): PathAlias[] {
  try {
    const raw = readFileSync(join(root, "tsconfig.json"), "utf8");
    // tsconfig allows comments and trailing commas
    const cleaned = raw
      .replace(/\/\/[^\n"]*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/,\s*([}\]])/g, "$1");
    const tsconfig = JSON.parse(cleaned);
    const paths: Record<string, string[]> = tsconfig.compilerOptions?.paths ?? {};
    const baseUrl: string = (tsconfig.compilerOptions?.baseUrl ?? ".")
      .replace(/^\.\//, "")
      .replace(/\/$/, "");
    const aliases: PathAlias[] = [];
    for (const [pattern, targets] of Object.entries(paths)) {
      const target = targets[0];
      if (!target || !pattern.endsWith("*") || !target.endsWith("*")) continue;
      const prefix = pattern.slice(0, -1);
      let targetPrefix = target.slice(0, -1).replace(/^\.\//, "");
      if (baseUrl && baseUrl !== ".") targetPrefix = `${baseUrl}/${targetPrefix}`;
      aliases.push({ prefix, target: targetPrefix });
    }
    return aliases;
  } catch {
    return [];
  }
}
