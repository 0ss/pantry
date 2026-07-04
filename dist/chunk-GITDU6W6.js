#!/usr/bin/env node
import {
  HARD_EXCLUDES,
  MAX_FILE_SIZE,
  ensurePantryDir,
  gitignoreGlobs,
  isTestFile,
  loadConfig,
  pantryDir
} from "./chunk-QZWZRDGW.js";
import {
  glob,
  scanDeps
} from "./chunk-B2O5OO6M.js";
import {
  loadFamilies
} from "./chunk-7SK2TDUQ.js";

// src/inventory/build.ts
import { createHash } from "crypto";
import { readFileSync as readFileSync3, statSync } from "fs";
import { join as join3 } from "path";

// src/scanner/cache.ts
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
var CACHE_VERSION = 1;
function loadCache(root) {
  try {
    const raw = readFileSync(join(pantryDir(root), "cache.json"), "utf8");
    const cache = JSON.parse(raw);
    if (cache.version === CACHE_VERSION && cache.files) return cache;
  } catch {
  }
  return { version: CACHE_VERSION, files: {} };
}
function saveCache(root, cache) {
  try {
    ensurePantryDir(root);
    writeFileSync(join(pantryDir(root), "cache.json"), JSON.stringify(cache));
  } catch {
  }
}

// src/scanner/source.ts
var parseSync = null;
async function loadParser() {
  if (parseSync) return true;
  try {
    parseSync = (await import("oxc-parser")).parseSync;
    return true;
  } catch {
    return false;
  }
}
var HOC_NAMES = /* @__PURE__ */ new Set(["memo", "forwardRef"]);
function scanSource(relFile, source) {
  try {
    return scanSourceInner(relFile, source);
  } catch {
    return { file: relFile, exports: [], imports: [], reexports: [], parseError: true };
  }
}
function scanSourceInner(relFile, source) {
  if (!parseSync) throw new Error("parser not loaded \u2014 call loadParser() first");
  const result = parseSync(relFile, source, {});
  if (result.errors.length > 0 && result.program.body.length === 0) {
    return { file: relFile, exports: [], imports: [], reexports: [], parseError: true };
  }
  const lineIndex = buildLineIndex(source);
  const lineOf = (offset) => lineIndex.findLine(offset);
  const docComments = result.comments.filter((c) => c.type === "Block" && c.value.startsWith("*"));
  const docBefore = (start) => {
    for (const c of docComments) {
      if (c.end <= start && source.slice(c.end, start).trim() === "") return firstDocLine(c.value);
    }
    return "";
  };
  const exports = [];
  const imports = [];
  const reexports = [];
  for (const imp of result.module.staticImports) {
    const names = [];
    let namespace = false;
    for (const entry of imp.entries) {
      if (entry.isType) continue;
      const kind = entry.importName.kind;
      if (kind === "NamespaceObject") namespace = true;
      else if (kind === "Default") names.push("default");
      else if (kind === "Name" && "name" in entry.importName && entry.importName.name) {
        names.push(entry.importName.name);
      }
    }
    imports.push({ specifier: imp.moduleRequest.value, names, namespace, dynamic: false });
  }
  for (const dyn of result.module.dynamicImports) {
    const spec = source.slice(dyn.moduleRequest.start, dyn.moduleRequest.end);
    const unquoted = spec.replace(/^['"`]|['"`]$/g, "");
    if (!unquoted.includes("${")) {
      imports.push({ specifier: unquoted, names: [], namespace: true, dynamic: true });
    }
  }
  for (const exp of result.module.staticExports) {
    for (const entry of exp.entries) {
      const req = "moduleRequest" in entry ? entry.moduleRequest : void 0;
      if (!req?.value) continue;
      if (entry.importName.kind === "AllButDefault" || entry.importName.kind === "All") {
        reexports.push({ specifier: req.value, names: "all" });
      } else if (entry.importName.kind === "Name" && "name" in entry.importName && entry.importName.name) {
        const existing = reexports.find((r) => r.specifier === req.value && r.names !== "all");
        if (existing && existing.names !== "all") existing.names.push(entry.importName.name);
        else reexports.push({ specifier: req.value, names: [entry.importName.name] });
      }
    }
  }
  for (const stmt of result.program.body) {
    if (stmt.type === "ExportNamedDeclaration" && stmt.declaration) {
      const decl = stmt.declaration;
      const doc = docBefore(stmt.start);
      if (decl.type === "FunctionDeclaration" && decl.id) {
        exports.push(classifyFunction(decl.id.name, decl, source, lineOf(decl.start), doc, false));
      } else if (decl.type === "VariableDeclaration") {
        for (const d of decl.declarations) {
          if (d.id.type !== "Identifier") continue;
          exports.push(classifyVariable(d.id.name, d.init, source, lineOf(d.start), doc));
        }
      } else if (decl.type === "TSTypeAliasDeclaration" || decl.type === "TSInterfaceDeclaration") {
        exports.push({
          name: decl.id.name,
          kind: /Schema$/.test(decl.id.name) ? "schema" : "type",
          line: lineOf(decl.start),
          signature: "",
          doc,
          isDefault: false
        });
      } else if (decl.type === "ClassDeclaration" && decl.id) {
        const hasJsx = containsJSX(decl);
        exports.push({
          name: decl.id.name,
          kind: hasJsx ? "component" : "util",
          line: lineOf(decl.start),
          signature: "",
          doc,
          isDefault: false
        });
      }
    } else if (stmt.type === "ExportDefaultDeclaration") {
      const doc = docBefore(stmt.start);
      const fromFilename = componentNameFromFile(relFile);
      let decl = stmt.declaration;
      let name = fromFilename;
      if (decl.type === "CallExpression") {
        const calleeName = decl.callee.type === "Identifier" ? decl.callee.name : decl.callee.type === "MemberExpression" && decl.callee.property.type === "Identifier" ? decl.callee.property.name : "";
        if (HOC_NAMES.has(calleeName) && decl.arguments.length > 0) {
          const inner = decl.arguments[0];
          if (inner && inner.type === "Identifier") {
            name = inner.name;
            exports.push({
              name,
              kind: sourceHasJSX(relFile, source) ? "component" : "util",
              line: lineOf(stmt.start),
              signature: "",
              doc,
              isDefault: true
            });
            continue;
          }
          if (inner && (inner.type === "FunctionExpression" || inner.type === "ArrowFunctionExpression")) {
            decl = inner;
          }
        }
      }
      if (decl.type === "FunctionDeclaration" || decl.type === "FunctionExpression" || decl.type === "ArrowFunctionExpression") {
        const declName = "id" in decl && decl.id ? decl.id.name : name;
        exports.push(classifyFunction(declName, decl, source, lineOf(stmt.start), doc, true));
      } else if (decl.type === "Identifier") {
        exports.push({
          name: decl.name,
          kind: isPascalCase(decl.name) && sourceHasJSX(relFile, source) ? "component" : "constant",
          line: lineOf(stmt.start),
          signature: "",
          doc,
          isDefault: true
        });
      } else if (decl.type === "ClassDeclaration") {
        exports.push({
          name: decl.id?.name ?? name,
          kind: containsJSX(decl) ? "component" : "util",
          line: lineOf(stmt.start),
          signature: "",
          doc,
          isDefault: true
        });
      }
    }
  }
  return { file: relFile, exports, imports, reexports, parseError: false };
}
function classifyFunction(name, fn, source, line, doc, isDefault) {
  const signature = paramsSignature(fn, source);
  let kind;
  if (/^use[A-Z]/.test(name)) kind = "hook";
  else if (isPascalCase(name) && containsJSX(fn.body)) kind = "component";
  else kind = "util";
  return { name, kind, line, signature, doc, isDefault };
}
function classifyVariable(name, init, source, line, doc) {
  let kind = "constant";
  let signature = "";
  if (init) {
    if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") {
      signature = paramsSignature(init, source);
      if (/^use[A-Z]/.test(name)) kind = "hook";
      else if (isPascalCase(name) && containsJSX(init.body)) kind = "component";
      else kind = "util";
    } else if (init.type === "CallExpression" && isSchemaCall(init)) {
      kind = "schema";
    } else if (/Schema$/.test(name)) {
      kind = "schema";
    }
  } else if (/Schema$/.test(name)) {
    kind = "schema";
  }
  return { name, kind, line, signature, doc, isDefault: false };
}
function isSchemaCall(call) {
  let callee = call.callee;
  for (let i = 0; i < 10 && callee; i++) {
    if (callee.type === "MemberExpression") {
      if (callee.object.type === "Identifier" && callee.object.name === "z") return true;
      callee = callee.object.type === "CallExpression" ? callee.object.callee : callee.object;
    } else if (callee.type === "CallExpression") {
      callee = callee.callee;
    } else {
      break;
    }
  }
  return false;
}
function paramsSignature(fn, source) {
  const params = fn.params;
  if (!params) return "()";
  const items = [];
  for (let p of Array.isArray(params) ? params : params.items ?? []) {
    if (p.type === "AssignmentPattern") p = p.left;
    const end = p.typeAnnotation ? p.typeAnnotation.start : p.end;
    const text = source.slice(p.start, end).replace(/\s*=\s*[^,}]+/g, "").replace(/\s+/g, " ").trim();
    if (text) items.push(text);
  }
  return `(${items.join(", ")})`;
}
function containsJSX(node) {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some(containsJSX);
  if (node.type === "JSXElement" || node.type === "JSXFragment") return true;
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end") continue;
    const value = node[key];
    if (value && typeof value === "object" && containsJSX(value)) return true;
  }
  return false;
}
var jsxCache = /* @__PURE__ */ new Map();
function sourceHasJSX(file, source) {
  const cached = jsxCache.get(file);
  if (cached !== void 0) return cached;
  const has = /\.[jt]sx$/.test(file) && /<[A-Za-z][^>]*>/.test(source);
  jsxCache.set(file, has);
  return has;
}
function isPascalCase(name) {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}
function componentNameFromFile(file) {
  const base = file.split("/").pop()?.replace(/\.[jt]sx?$/, "") ?? "default";
  if (base === "index") {
    const parts = file.split("/");
    return parts[parts.length - 2] ?? "default";
  }
  return base;
}
function firstDocLine(comment) {
  for (const line of comment.split("\n")) {
    const cleaned = line.replace(/^[\s*]+/, "").trim();
    if (cleaned && !cleaned.startsWith("@")) return cleaned;
  }
  return "";
}
function buildLineIndex(source) {
  const offsets = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") offsets.push(i + 1);
  }
  return {
    findLine(offset) {
      let lo = 0;
      let hi = offsets.length - 1;
      while (lo < hi) {
        const mid = lo + hi + 1 >> 1;
        if ((offsets[mid] ?? 0) <= offset) lo = mid;
        else hi = mid - 1;
      }
      return lo + 1;
    }
  };
}

// src/scanner/usage.ts
import { readFileSync as readFileSync2 } from "fs";
import { join as join2 } from "path";
var RESOLVE_EXTENSIONS = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx"
];
function countUsage(scans, aliases) {
  const fileSet = new Set(scans.map((s) => s.file));
  const scanByFile = new Map(scans.map((s) => [s.file, s]));
  const counts = /* @__PURE__ */ new Map();
  const depCounts = /* @__PURE__ */ new Map();
  let unresolvedImportCount = 0;
  const bump = (file, name, importer) => {
    let perFile = counts.get(file);
    if (!perFile) {
      perFile = /* @__PURE__ */ new Map();
      counts.set(file, perFile);
    }
    let entry = perFile.get(name);
    if (!entry) {
      entry = { files: /* @__PURE__ */ new Set(), testFiles: /* @__PURE__ */ new Set() };
      perFile.set(name, entry);
    }
    (isTestFile(importer) ? entry.testFiles : entry.files).add(importer);
  };
  const bumpResolved = (targetFile, name, importer, depth) => {
    const target = scanByFile.get(targetFile);
    if (!target) return;
    const direct = target.exports.some((e) => name === "default" ? e.isDefault : e.name === name);
    if (direct || depth > 0) {
      bump(targetFile, name, importer);
      return;
    }
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
    bump(targetFile, name, importer);
  };
  for (const scan of scans) {
    for (const imp of scan.imports) {
      if (!imp.specifier.startsWith(".") && !imp.specifier.startsWith("/") && !isAliased(imp.specifier, aliases)) {
        const pkg = packageNameOf(imp.specifier);
        if (pkg) {
          let set = depCounts.get(pkg);
          if (!set) {
            set = /* @__PURE__ */ new Set();
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
function isAliased(specifier, aliases) {
  return aliases.some((a) => specifier.startsWith(a.prefix));
}
function packageNameOf(specifier) {
  if (specifier.startsWith("node:")) return null;
  const parts = specifier.split("/");
  if (specifier.startsWith("@")) return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  return parts[0] || null;
}
function resolveSpecifier(specifier, importerFile, fileSet, aliases) {
  let base;
  if (specifier.startsWith(".")) {
    const dir = importerFile.split("/").slice(0, -1).join("/");
    base = normalizePath(dir ? `${dir}/${specifier}` : specifier);
  } else {
    const alias = aliases.find((a) => specifier.startsWith(a.prefix));
    if (!alias) return null;
    base = normalizePath(alias.target + specifier.slice(alias.prefix.length));
  }
  const variants = [base, base.replace(/\.[jt]sx?$/, "")];
  for (const v of variants) {
    for (const ext of RESOLVE_EXTENSIONS) {
      if (fileSet.has(v + ext)) return v + ext;
    }
  }
  return null;
}
function normalizePath(path) {
  const parts = [];
  for (const part of path.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}
function loadPathAliases(root) {
  try {
    const raw = readFileSync2(join2(root, "tsconfig.json"), "utf8");
    const cleaned = raw.replace(/\/\/[^\n"]*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/,\s*([}\]])/g, "$1");
    const tsconfig = JSON.parse(cleaned);
    const paths = tsconfig.compilerOptions?.paths ?? {};
    const baseUrl = (tsconfig.compilerOptions?.baseUrl ?? ".").replace(/^\.\//, "").replace(/\/$/, "");
    const aliases = [];
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

// src/inventory/build.ts
async function buildInventory(root) {
  const config = loadConfig(root);
  const families = loadFamilies(root);
  const hasParser = await loadParser();
  const files = hasParser ? await glob(config.include, {
    cwd: root,
    ignore: [...HARD_EXCLUDES, ...config.exclude, ...gitignoreGlobs(root)],
    followSymbolicLinks: false,
    onlyFiles: true
  }) : [];
  files.sort();
  const cache = loadCache(root);
  const nextCache = { version: cache.version, files: {} };
  const scans = [];
  let parseErrorCount = 0;
  let parsedCount = 0;
  const hashInput = [];
  for (const file of files) {
    const abs = join3(root, file);
    let mtimeMs;
    let size;
    try {
      const stat = statSync(abs);
      mtimeMs = stat.mtimeMs;
      size = stat.size;
    } catch {
      continue;
    }
    if (size > MAX_FILE_SIZE) continue;
    hashInput.push(`${file}:${mtimeMs}:${size}`);
    const cached = cache.files[file];
    let scan;
    if (cached && cached.mtimeMs === mtimeMs && cached.size === size) {
      scan = cached.scan;
    } else {
      let source;
      try {
        source = readFileSync3(abs, "utf8");
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
  const deps = scanDeps(root, families);
  for (const dep of deps) {
    dep.usageCount = usage.depCounts.get(dep.name)?.size ?? 0;
  }
  try {
    const pkgStat = statSync(join3(root, "package.json"));
    hashInput.push(`package.json:${pkgStat.mtimeMs}:${pkgStat.size}`);
  } catch {
  }
  if (!deps.some((d) => d.family === "ui-kit")) {
    const uiFiles = scans.filter((s) => /(^|\/)components\/ui\//.test(s.file));
    if (uiFiles.length > 0) {
      const importers = /* @__PURE__ */ new Set();
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
        dev: false
      });
    }
  }
  const fileSet = new Set(scans.map((s) => s.file));
  const scanByFile = new Map(scans.map((s) => [s.file, s]));
  const barrelOf = /* @__PURE__ */ new Map();
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
  const entries = [];
  for (const scan of scans) {
    if (isTestFile(scan.file)) continue;
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
        topImporters: [...u?.files ?? [], ...u?.testFiles ?? []].sort().slice(0, 3),
        ...barrel ? { exportedFrom: barrel } : {}
      });
    }
  }
  entries.sort(
    (a, b) => b.usageCount - a.usageCount || a.file.localeCompare(b.file) || a.name.localeCompare(b.name)
  );
  const inventory = {
    entries,
    deps,
    meta: {
      scannedAt: (/* @__PURE__ */ new Date()).toISOString(),
      fileCount: scans.length,
      hashOfInputs: createHash("sha256").update(hashInput.join("\n")).digest("hex").slice(0, 16),
      parseErrorCount,
      unresolvedImportCount: usage.unresolvedImportCount
    }
  };
  saveCache(root, nextCache);
  return { inventory, parsedCount };
}

// src/inventory/summarize.ts
import { writeFileSync as writeFileSync2 } from "fs";
import { join as join4 } from "path";
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}
function summarize(inventory, root) {
  const config = loadConfig(root);
  const budget = config.tokenBudget;
  const families = loadFamilies(root);
  const familyById = new Map(families.map((f) => [f.id, f]));
  const covered = inventory.deps.filter((d) => d.family && !d.dev);
  const byFamily = /* @__PURE__ */ new Map();
  for (const dep of covered) {
    const list = byFamily.get(dep.family) ?? [];
    list.push(dep);
    byFamily.set(dep.family, list);
  }
  const capLines = [];
  for (const [familyId, deps] of [...byFamily.entries()].sort()) {
    const family = familyById.get(familyId);
    const names = deps.map((d) => `${d.name} (${d.usageCount} file${d.usageCount === 1 ? "" : "s"})`).join(", ");
    const others = family?.packages.filter((p) => !p.includes("*") && !deps.some((d) => d.name === p)).slice(0, 3).join("/");
    const warn = family?.exclusive && others ? ` \u2014 do not install ${others}` : "";
    capLines.push(`- ${familyId}: ${names}${warn}`);
  }
  const reusables = inventory.entries.filter(
    (e) => e.usageCount > 0 && (e.kind === "component" || e.kind === "hook" || e.kind === "util" || e.kind === "schema")
  ).slice(0, 60);
  const render = (entryCount) => {
    const lines = [
      "# \u{1F96B} Pantry \u2014 what this repo already has",
      "",
      "Before writing a new component/hook/util/schema or installing a package,",
      'run `pantry check "<need>"` and follow its recommendation.',
      ""
    ];
    if (capLines.length > 0) {
      lines.push("## Installed capabilities", ...capLines, "");
    }
    const shown = reusables.slice(0, entryCount);
    if (shown.length > 0) {
      lines.push("## Top reusables (usage-ranked)");
      for (const e of shown) {
        const sig = e.signature && e.signature !== "()" ? e.signature : "";
        lines.push(`- ${e.name}${sig} \u2014 ${e.file} (${e.usageCount} uses, ${e.kind})`);
      }
      lines.push("");
    }
    if (capLines.length === 0 && shown.length === 0) {
      lines.push("Pantry is empty \u2014 no reusable exports or mapped dependencies yet.", "");
    }
    lines.push(`_${inventory.meta.fileCount} files scanned. \`pantry sync\` refreshes this._`);
    return lines.join("\n");
  };
  let count = reusables.length;
  let text = render(count);
  while (estimateTokens(text) > budget && count > 0) {
    count = Math.max(0, count - 3);
    text = render(count);
  }
  return text;
}
function writeSummary(inventory, root) {
  const text = summarize(inventory, root);
  ensurePantryDir(root);
  writeFileSync2(join4(root, ".pantry", "PANTRY.md"), text);
  return text;
}

export {
  buildInventory,
  writeSummary
};
