#!/usr/bin/env node
import {
  loadAllowList
} from "./chunk-PVKDUMKN.js";
import {
  require_picocolors
} from "./chunk-COWW6QSR.js";
import {
  loadInventory
} from "./chunk-QZWZRDGW.js";
import {
  loadFamilies,
  matchedPattern
} from "./chunk-DID37CC6.js";
import {
  __toESM
} from "./chunk-FYS2JH42.js";

// src/commands/audit.ts
var import_picocolors = __toESM(require_picocolors(), 1);
async function audit(root, opts = {}) {
  let inventory = loadInventory(root);
  if (!inventory) {
    if (!opts.json) console.error("(no inventory yet \u2014 running pantry init first)");
    const { init } = await import("./init-FXK6TDEF.js");
    await init(root, { quiet: true });
    inventory = loadInventory(root);
    if (!inventory) {
      console.error("Could not build an inventory here.");
      console.error("Run `pantry init` in the repo root and check .pantry/errors.log.");
      return 1;
    }
  }
  const report = buildAuditReport(inventory, root);
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderAudit(report));
  }
  if (opts.strict) {
    const violation = report.duplicateFamilies.some(
      (d) => d.exclusive && d.packages.filter((p) => !p.allowed).length > 1
    );
    if (violation) return 1;
  }
  return 0;
}
function buildAuditReport(inventory, root) {
  const families = loadFamilies(root);
  const familyById = new Map(families.map((f) => [f.id, f]));
  const allowed = new Set(loadAllowList(root).map((a) => a.pkg));
  return {
    duplicateFamilies: findDuplicateFamilies(inventory.deps, familyById, allowed),
    duplicateExports: findDuplicateExports(inventory.entries),
    nativeReplaceable: findNativeReplaceable(inventory.deps, familyById)
  };
}
function findDuplicateFamilies(deps, familyById, allowed) {
  const byFamily = /* @__PURE__ */ new Map();
  for (const dep of deps) {
    if (!dep.family || dep.dev) continue;
    byFamily.set(dep.family, [...byFamily.get(dep.family) ?? [], dep]);
  }
  const duplicates = [];
  for (const [familyId, members] of [...byFamily.entries()].sort()) {
    const family = familyById.get(familyId);
    const grouped = groupProducts(members, family);
    if (grouped.length < 2) continue;
    duplicates.push({
      family: familyId,
      label: family?.label ?? familyId,
      exclusive: family?.exclusive ?? false,
      packages: grouped.sort((a, b) => b.usageCount - a.usageCount).map((m) => ({ name: m.name, usageCount: m.usageCount, allowed: m.allowed }))
    });
  }
  return duplicates;
  function groupProducts(members, family) {
    const groups = /* @__PURE__ */ new Map();
    for (const m of members) {
      const pattern = family ? matchedPattern(m.name, family) : null;
      let key = pattern?.includes("*") ? pattern : m.name;
      for (const existing of groups.keys()) {
        if (contains(existing, key) || contains(key, existing)) {
          key = existing;
          break;
        }
      }
      const group = groups.get(key);
      if (group) {
        group.usageCount += m.usageCount;
        group.count++;
        group.allowed = group.allowed && allowed.has(m.name);
        if (pattern?.includes("*")) group.name = `${pattern} (${group.count} packages)`;
        else if (!group.name.includes(" + ")) group.name = `${group.name} + ${m.name}`;
      } else {
        groups.set(key, {
          name: m.name,
          usageCount: m.usageCount,
          allowed: allowed.has(m.name),
          count: 1
        });
      }
    }
    return [...groups.values()];
  }
  function contains(a, b) {
    return a !== b && (a.endsWith(`-${b}`) || a.startsWith(`${b}-`) || b.endsWith(`-${a}`) || b.startsWith(`${a}-`));
  }
}
function findDuplicateExports(entries) {
  const byName = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    if (entry.kind === "type" || entry.kind === "constant") continue;
    byName.set(entry.name, [...byName.get(entry.name) ?? [], entry]);
  }
  const duplicates = [];
  for (const [name, defs] of [...byName.entries()].sort()) {
    const files = new Set(defs.map((d) => d.file));
    if (files.size < 2) continue;
    duplicates.push({
      name,
      definitions: defs.sort((a, b) => b.usageCount - a.usageCount).map((d) => ({ file: d.file, line: d.line, usageCount: d.usageCount }))
    });
  }
  return duplicates;
}
function findNativeReplaceable(deps, familyById) {
  const findings = [];
  for (const dep of deps) {
    if (!dep.family || dep.dev) continue;
    const family = familyById.get(dep.family);
    if (family?.native) {
      findings.push({ package: dep.name, native: family.native.name, note: family.native.note });
    }
  }
  return findings.sort((a, b) => a.package.localeCompare(b.package));
}
function renderAudit(report) {
  const color = process.stdout.isTTY;
  const bold = (s) => color ? import_picocolors.default.bold(s) : s;
  const yellow = (s) => color ? import_picocolors.default.yellow(s) : s;
  const red = (s) => color ? import_picocolors.default.red(s) : s;
  const lines = [bold("\u{1F96B} PANTRY AUDIT"), ""];
  if (report.duplicateFamilies.length > 0) {
    lines.push(bold("Duplicate capability families:"));
    for (const dup of report.duplicateFamilies) {
      const names = dup.packages.map((p) => `${p.name} (${count(p.usageCount, "file")}${p.allowed ? ", allowed" : ""})`).join(", ");
      const mark = dup.exclusive ? red("\u2717") : yellow("~");
      lines.push(`  ${mark} ${dup.packages.length} ${plural(dup.label)}: ${names}`);
    }
    lines.push("");
  }
  if (report.duplicateExports.length > 0) {
    lines.push(bold("Same export defined in multiple places:"));
    for (const dup of report.duplicateExports.slice(0, 10)) {
      lines.push(`  ${yellow("~")} ${dup.name} \xD7 ${dup.definitions.length}`);
      for (const def of dup.definitions) {
        lines.push(`      ${def.file}:${def.line} (${count(def.usageCount, "use")})`);
      }
    }
    if (report.duplicateExports.length > 10) {
      lines.push(`      \u2026and ${report.duplicateExports.length - 10} more (use --json for all)`);
    }
    lines.push("");
  }
  if (report.nativeReplaceable.length > 0) {
    lines.push(bold("Deps the platform already covers:"));
    for (const finding of report.nativeReplaceable) {
      lines.push(`  ${yellow("~")} ${finding.package} \u2192 ${finding.native}`);
      lines.push(`      ${finding.note}`);
    }
    lines.push("");
  }
  const total = report.duplicateFamilies.length + report.duplicateExports.length + report.nativeReplaceable.length;
  if (total === 0) {
    lines.push("Pantry is tidy. No duplicate families, no duplicate exports,");
    lines.push("nothing the platform already covers.");
  } else {
    lines.push(
      `${total} finding${total === 1 ? "" : "s"}. Deliberate duplicates? \`pantry allow <pkg> --reason "..."\``
    );
  }
  return lines.join("\n");
}
function plural(label) {
  return label.endsWith("s") ? label : `${label.replace(/y$/, "ie")}s`;
}
function count(n, noun) {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
export {
  audit,
  buildAuditReport
};
