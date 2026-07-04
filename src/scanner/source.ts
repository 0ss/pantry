import type { ExportKind } from "../types.js";

// oxc-parser ships native binaries, so it can't be bundled into the plugin
// hooks. Load it lazily; without it we fall back to deps-only inventories
// (the install-bouncer doesn't need source parsing at all).
type ParseSyncFn = typeof import("oxc-parser").parseSync;
let parseSync: ParseSyncFn | null = null;

export async function loadParser(): Promise<boolean> {
  if (parseSync) return true;
  try {
    parseSync = (await import("oxc-parser")).parseSync;
    return true;
  } catch {
    return false;
  }
}

export interface RawExport {
  name: string;
  kind: ExportKind;
  line: number;
  signature: string;
  doc: string;
  isDefault: boolean;
}

export interface RawImport {
  specifier: string;
  /** Named imports (importName), default import as "default". */
  names: string[];
  namespace: boolean;
  dynamic: boolean;
}

export interface RawReexport {
  specifier: string;
  /** Re-exported names, or "all" for `export * from`. */
  names: string[] | "all";
}

export interface FileScan {
  file: string;
  exports: RawExport[];
  imports: RawImport[];
  reexports: RawReexport[];
  parseError: boolean;
}

const HOC_NAMES = new Set(["memo", "forwardRef"]);

/** Parse one file. Never throws — parse failures return parseError: true. */
export function scanSource(relFile: string, source: string): FileScan {
  try {
    return scanSourceInner(relFile, source);
  } catch {
    return { file: relFile, exports: [], imports: [], reexports: [], parseError: true };
  }
}

function scanSourceInner(relFile: string, source: string): FileScan {
  if (!parseSync) throw new Error("parser not loaded — call loadParser() first");
  const result = parseSync(relFile, source, {});
  if (result.errors.length > 0 && result.program.body.length === 0) {
    return { file: relFile, exports: [], imports: [], reexports: [], parseError: true };
  }

  const lineIndex = buildLineIndex(source);
  const lineOf = (offset: number) => lineIndex.findLine(offset);
  const docComments = result.comments.filter((c) => c.type === "Block" && c.value.startsWith("*"));
  const docBefore = (start: number): string => {
    for (const c of docComments) {
      if (c.end <= start && source.slice(c.end, start).trim() === "") return firstDocLine(c.value);
    }
    return "";
  };

  const exports: RawExport[] = [];
  const imports: RawImport[] = [];
  const reexports: RawReexport[] = [];

  // -- imports (usage graph edges) --
  for (const imp of result.module.staticImports) {
    const names: string[] = [];
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
    // template literals with expressions are unresolvable — skip those
    if (!unquoted.includes("${")) {
      imports.push({ specifier: unquoted, names: [], namespace: true, dynamic: true });
    }
  }

  // -- re-exports (barrels) --
  for (const exp of result.module.staticExports) {
    for (const entry of exp.entries) {
      const req = "moduleRequest" in entry ? entry.moduleRequest : undefined;
      if (!req?.value) continue;
      if (entry.importName.kind === "AllButDefault" || entry.importName.kind === "All") {
        reexports.push({ specifier: req.value, names: "all" });
      } else if (
        entry.importName.kind === "Name" &&
        "name" in entry.importName &&
        entry.importName.name
      ) {
        const existing = reexports.find((r) => r.specifier === req.value && r.names !== "all");
        if (existing && existing.names !== "all") existing.names.push(entry.importName.name);
        else reexports.push({ specifier: req.value, names: [entry.importName.name] });
      }
    }
  }

  // -- exported declarations, classified by AST --
  for (const stmt of result.program.body) {
    if (stmt.type === "ExportNamedDeclaration" && stmt.declaration) {
      const decl = stmt.declaration;
      const doc = docBefore(stmt.start);
      if (decl.type === "FunctionDeclaration" && decl.id) {
        exports.push(classifyFunction(decl.id.name, decl, source, lineOf(decl.start), doc, false));
      } else if (decl.type === "VariableDeclaration") {
        for (const d of decl.declarations) {
          if (d.id.type !== "Identifier") continue; // destructured exports: skip
          exports.push(classifyVariable(d.id.name, d.init, source, lineOf(d.start), doc));
        }
      } else if (decl.type === "TSTypeAliasDeclaration" || decl.type === "TSInterfaceDeclaration") {
        exports.push({
          name: decl.id.name,
          kind: /Schema$/.test(decl.id.name) ? "schema" : "type",
          line: lineOf(decl.start),
          signature: "",
          doc,
          isDefault: false,
        });
      } else if (decl.type === "ClassDeclaration" && decl.id) {
        const hasJsx = containsJSX(decl);
        exports.push({
          name: decl.id.name,
          kind: hasJsx ? "component" : "util",
          line: lineOf(decl.start),
          signature: "",
          doc,
          isDefault: false,
        });
      }
    } else if (stmt.type === "ExportDefaultDeclaration") {
      const doc = docBefore(stmt.start);
      const fromFilename = componentNameFromFile(relFile);
      let decl = stmt.declaration;
      let name = fromFilename;
      // unwrap memo(X) / forwardRef(X) / React.memo(X)
      if (decl.type === "CallExpression") {
        const calleeName =
          decl.callee.type === "Identifier"
            ? decl.callee.name
            : decl.callee.type === "MemberExpression" && decl.callee.property.type === "Identifier"
              ? decl.callee.property.name
              : "";
        if (HOC_NAMES.has(calleeName) && decl.arguments.length > 0) {
          const inner = decl.arguments[0];
          if (inner && inner.type === "Identifier") {
            name = inner.name;
            // classify by looking at the file: if any JSX exists, call it a component
            exports.push({
              name,
              kind: sourceHasJSX(relFile, source) ? "component" : "util",
              line: lineOf(stmt.start),
              signature: "",
              doc,
              isDefault: true,
            });
            continue;
          }
          if (
            inner &&
            (inner.type === "FunctionExpression" || inner.type === "ArrowFunctionExpression")
          ) {
            decl = inner;
          }
        }
      }
      if (
        decl.type === "FunctionDeclaration" ||
        decl.type === "FunctionExpression" ||
        decl.type === "ArrowFunctionExpression"
      ) {
        const declName = "id" in decl && decl.id ? decl.id.name : name;
        exports.push(classifyFunction(declName, decl, source, lineOf(stmt.start), doc, true));
      } else if (decl.type === "Identifier") {
        // export default Foo — kind from name shape + file JSX
        exports.push({
          name: decl.name,
          kind: isPascalCase(decl.name) && sourceHasJSX(relFile, source) ? "component" : "constant",
          line: lineOf(stmt.start),
          signature: "",
          doc,
          isDefault: true,
        });
      } else if (decl.type === "ClassDeclaration") {
        exports.push({
          name: decl.id?.name ?? name,
          kind: containsJSX(decl) ? "component" : "util",
          line: lineOf(stmt.start),
          signature: "",
          doc,
          isDefault: true,
        });
      }
    }
  }

  return { file: relFile, exports, imports, reexports, parseError: false };
}

// AST nodes are dynamically shaped — one aliased any beats sprinkling casts
// biome-ignore lint/suspicious/noExplicitAny: see above
type AstNode = any;

function classifyFunction(
  name: string,
  fn: AstNode,
  source: string,
  line: number,
  doc: string,
  isDefault: boolean,
): RawExport {
  const signature = paramsSignature(fn, source);
  let kind: ExportKind;
  if (/^use[A-Z]/.test(name)) kind = "hook";
  else if (isPascalCase(name) && containsJSX(fn.body)) kind = "component";
  else kind = "util";
  return { name, kind, line, signature, doc, isDefault };
}

function classifyVariable(
  name: string,
  init: AstNode,
  source: string,
  line: number,
  doc: string,
): RawExport {
  let kind: ExportKind = "constant";
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

/** exported call to z.object / z.union / z.* → schema */
// biome-ignore lint/suspicious/noExplicitAny: AST nodes are dynamically shaped
function isSchemaCall(call: any): boolean {
  let callee = call.callee;
  // z.object({}).extend({}) chains: walk down member calls to the root
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

// biome-ignore lint/suspicious/noExplicitAny: AST nodes are dynamically shaped
function paramsSignature(fn: any, source: string): string {
  const params = fn.params;
  if (!params) return "()";
  const items: string[] = [];
  for (let p of Array.isArray(params) ? params : (params.items ?? [])) {
    if (p.type === "AssignmentPattern") p = p.left; // drop `= default`
    // slice the pattern only, not its type annotation
    const end = p.typeAnnotation ? p.typeAnnotation.start : p.end;
    const text = source
      .slice(p.start, end)
      .replace(/\s*=\s*[^,}]+/g, "") // inner destructuring defaults
      .replace(/\s+/g, " ")
      .trim();
    if (text) items.push(text);
  }
  return `(${items.join(", ")})`;
}

/** Recursive JSX presence check. Bounded by node count, not depth-limited. */
// biome-ignore lint/suspicious/noExplicitAny: AST nodes are dynamically shaped
function containsJSX(node: any): boolean {
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

const jsxCache = new Map<string, boolean>();
function sourceHasJSX(file: string, source: string): boolean {
  const cached = jsxCache.get(file);
  if (cached !== undefined) return cached;
  // cheap heuristic for whole-file JSX presence (used only for HOC-wrapped defaults)
  const has = /\.[jt]sx$/.test(file) && /<[A-Za-z][^>]*>/.test(source);
  jsxCache.set(file, has);
  return has;
}

function isPascalCase(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

function componentNameFromFile(file: string): string {
  const base =
    file
      .split("/")
      .pop()
      ?.replace(/\.[jt]sx?$/, "") ?? "default";
  if (base === "index") {
    const parts = file.split("/");
    return parts[parts.length - 2] ?? "default";
  }
  return base;
}

function firstDocLine(comment: string): string {
  for (const line of comment.split("\n")) {
    const cleaned = line.replace(/^[\s*]+/, "").trim();
    if (cleaned && !cleaned.startsWith("@")) return cleaned;
  }
  return "";
}

function buildLineIndex(source: string): { findLine: (offset: number) => number } {
  const offsets: number[] = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") offsets.push(i + 1);
  }
  return {
    findLine(offset: number): number {
      let lo = 0;
      let hi = offsets.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if ((offsets[mid] ?? 0) <= offset) lo = mid;
        else hi = mid - 1;
      }
      return lo + 1;
    },
  };
}
