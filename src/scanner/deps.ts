import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "tinyglobby";
import { familyForPackage, loadFamilies } from "../capabilities/match.js";
import type { CapabilityFamily, DepEntry } from "../types.js";

interface RawDep {
  name: string;
  version: string;
  dev: boolean;
}

/**
 * Read root package.json plus any workspace package.jsons and merge their
 * dependencies. Flat merge only — first occurrence wins, dev flag is OR'd.
 */
export function scanDeps(root: string, families?: CapabilityFamily[]): DepEntry[] {
  const fams = families ?? loadFamilies(root);
  const raw = collectRawDeps(root);
  return raw.map((d) => ({
    name: d.name,
    version: d.version,
    family: familyForPackage(d.name, fams)?.id ?? null,
    usageCount: 0, // filled in by usage scanner
    dev: d.dev,
  }));
}

function collectRawDeps(root: string): RawDep[] {
  const seen = new Map<string, RawDep>();
  const rootPkg = readPackageJson(join(root, "package.json"));
  if (!rootPkg) return [];
  const pkgFiles = [join(root, "package.json")];

  // flat workspace handling: merge every workspace package.json.
  // npm/yarn declare them in package.json, pnpm in pnpm-workspace.yaml.
  const workspaces: string[] = Array.isArray(rootPkg.workspaces)
    ? rootPkg.workspaces
    : Array.isArray(rootPkg.workspaces?.packages)
      ? rootPkg.workspaces.packages
      : pnpmWorkspaceGlobs(root);
  if (workspaces.length > 0) {
    const patterns = workspaces.map((w: string) => `${w.replace(/\/$/, "")}/package.json`);
    try {
      const found = globSync(patterns, { cwd: root, ignore: ["**/node_modules/**"] });
      pkgFiles.push(...found.map((f) => join(root, f)));
    } catch {
      // bad workspace glob — root deps only
    }
  }

  for (const file of pkgFiles) {
    const pkg = readPackageJson(file);
    if (!pkg) continue;
    for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
      addDep(seen, name, String(version), false);
    }
    for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
      addDep(seen, name, String(version), true);
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function addDep(seen: Map<string, RawDep>, name: string, version: string, dev: boolean): void {
  const existing = seen.get(name);
  if (existing) {
    existing.dev = existing.dev && dev; // prod anywhere → prod
  } else {
    seen.set(name, { name, version, dev });
  }
}

/**
 * pnpm-workspace.yaml is YAML, but the part we need is a flat string list —
 * hand-parse it rather than pull in a YAML dep for eight lines of file.
 * known ceiling: breaks on exotic YAML (anchors, flow style); nobody writes
 * their workspace list that way.
 */
function pnpmWorkspaceGlobs(root: string): string[] {
  let raw: string;
  try {
    raw = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
  } catch {
    return [];
  }
  const globs: string[] = [];
  let inPackages = false;
  for (const line of raw.split(/\r?\n/)) {
    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      const item = line.match(/^\s+-\s*["']?([^"'#]+?)["']?\s*(#.*)?$/);
      if (item?.[1]) {
        const glob = item[1].trim();
        if (!glob.startsWith("!")) globs.push(glob); // negations: just skip them
      } else if (/^\S/.test(line) && line.trim() !== "") {
        inPackages = false; // next top-level key
      }
    }
  }
  return globs;
}

export class MalformedPackageJsonError extends Error {
  constructor(public file: string) {
    super(`malformed JSON in ${file}`);
  }
}

// biome-ignore lint/suspicious/noExplicitAny: package.json is untyped input
function readPackageJson(file: string): any | null {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return null; // no package.json — source-only mode
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new MalformedPackageJsonError(file);
  }
}
