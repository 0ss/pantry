#!/usr/bin/env node
import {
  require_picocolors
} from "./chunk-COWW6QSR.js";
import {
  recordEvent
} from "./chunk-ERKV7XNB.js";
import {
  loadInventory,
  pantryDir
} from "./chunk-QZWZRDGW.js";
import {
  expandNeed,
  familiesForNeed,
  loadFamilies,
  tokenize
} from "./chunk-DID37CC6.js";
import {
  __toESM
} from "./chunk-FYS2JH42.js";

// src/commands/check.ts
import { existsSync, statSync } from "fs";
import { join } from "path";

// src/query/render.ts
var import_picocolors = __toESM(require_picocolors(), 1);
function renderCheck(result, opts = {}) {
  if (opts.json) {
    return JSON.stringify(
      {
        need: result.need,
        empty: result.empty,
        installed: result.installed.map(({ dep, family }) => ({
          name: dep.name,
          family: family.id,
          usageCount: dep.usageCount
        })),
        code: result.code.map(({ entry, score }) => ({
          name: entry.name,
          kind: entry.kind,
          file: entry.file,
          line: entry.line,
          signature: entry.signature,
          usageCount: entry.usageCount,
          testUsageCount: entry.testUsageCount,
          score: Math.round(score)
        })),
        usedIn: result.usedIn,
        recommendation: result.recommendation.join(" ")
      },
      null,
      2
    );
  }
  const color = !opts.plain && process.stdout.isTTY;
  const bold = (s) => color ? import_picocolors.default.bold(s) : s;
  const dim = (s) => color ? import_picocolors.default.dim(s) : s;
  const green = (s) => color ? import_picocolors.default.green(s) : s;
  const lines = [bold("\u{1F96B} PANTRY CHECK"), `Need: ${result.need}`];
  if (result.empty) {
    lines.push("", "Pantry is empty for this. Building new is justified.");
    return lines.join("\n");
  }
  if (result.installed.length > 0) {
    lines.push("", bold("Already installed:"));
    for (const { dep } of result.installed.slice(0, 3)) {
      const where = dep.version === "local" ? "in-repo" : "package.json";
      lines.push(`  ${green("\u2713")} ${dep.name} (${where}, ${usedIn(dep.usageCount, 0)})`);
    }
  }
  const recLines = result.recommendation.length > 0 ? 3 : 0;
  const usedInLines = result.usedIn.length > 0 ? 2 + Math.min(result.usedIn.length, 3) : 0;
  let codeBudget = 20 - lines.length - recLines - (result.code.length > 0 ? 2 : 0);
  let showUsedIn = true;
  if (codeBudget - usedInLines >= 3) {
    codeBudget -= usedInLines;
  } else {
    showUsedIn = false;
  }
  if (result.code.length > 0) {
    const shown = result.code.slice(0, Math.max(1, codeBudget));
    lines.push("", bold("Existing code:"));
    const labels = shown.map(({ entry }) => `${entry.name}${entry.signature}`);
    const width = Math.max(...labels.map((l) => l.length));
    shown.forEach(({ entry }, i) => {
      const label = labels[i];
      lines.push(`  ${green("\u2713")} ${label.padEnd(width)}  ${entry.file}${dim(`:${entry.line}`)}`);
    });
  }
  if (showUsedIn && result.usedIn.length > 0) {
    lines.push("", bold("Used in:"));
    for (const file of result.usedIn.slice(0, 3)) lines.push(`  - ${file}`);
  }
  if (result.recommendation.length > 0) {
    lines.push("", bold("Recommendation:"), `  ${result.recommendation.join(" ")}`);
  }
  return lines.join("\n");
}
function usedIn(total, tests) {
  const files = `used in ${total} file${total === 1 ? "" : "s"}`;
  return tests > 0 ? `${files} (${tests} tests)` : files;
}

// src/query/score.ts
var SCORE_FLOOR = 40;
function query(inventory, need, root, top = 5) {
  const families = loadFamilies(root);
  const needTokens = tokenize(need);
  const expanded = expandNeed(need, families);
  const needFamilies = familiesForNeed(need, families);
  const needFamilyIds = new Set(needFamilies.map((f) => f.id));
  const installed = inventory.deps.filter((d) => d.family && needFamilyIds.has(d.family) && !d.dev).map((dep) => ({
    dep,
    family: needFamilies.find((f) => f.id === dep.family)
  })).sort((a, b) => b.dep.usageCount - a.dep.usageCount);
  const scored = [];
  for (const entry of inventory.entries) {
    const score = scoreEntry(entry, needTokens, expanded, needFamilyIds);
    if (score >= SCORE_FLOOR) scored.push({ entry, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.entry.file.localeCompare(b.entry.file) || a.entry.name.localeCompare(b.entry.name)
  );
  const code = scored.slice(0, top);
  const empty = installed.length === 0 && code.length === 0;
  return {
    need,
    installed,
    code,
    usedIn: code[0]?.entry.topImporters ?? [],
    recommendation: buildRecommendation(installed, code),
    empty
  };
}
function scoreEntry(entry, needTokens, expanded, needFamilyIds) {
  const nameLower = entry.name.toLowerCase();
  const nameTokens = splitIdentifier(entry.name);
  let base = 0;
  if (needTokens.includes(nameLower) || needTokens.join("") === nameLower) base = 100;
  else if (nameTokens.some((t) => needTokens.includes(t))) {
    const overlap = nameTokens.filter((t) => needTokens.includes(t)).length;
    base = overlap >= 2 ? 90 : 60;
  } else if (expanded.some((t) => nameLower.startsWith(t) || nameTokens.includes(t))) {
    base = 50;
  }
  const pathTokens = entry.file.toLowerCase().split(/[/.\-_]/);
  if (pathTokens.some((seg) => needTokens.includes(seg) || expanded.includes(seg))) {
    base = Math.max(base, 40);
  }
  if (entry.doc) {
    const docTokens = tokenize(entry.doc);
    if (needTokens.some((t) => docTokens.includes(t))) base += 20;
  }
  if (base === 0) return 0;
  const kindWeight = entry.kind === "type" || entry.kind === "constant" ? 0.5 : 1;
  return base * kindWeight * (1 + Math.log10(1 + entry.usageCount));
}
function splitIdentifier(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").toLowerCase().split(/\s+/).filter(Boolean);
}
function buildRecommendation(installed, code) {
  const lines = [];
  const topHit = code[0];
  if (topHit) {
    lines.push(`Reuse ${topHit.entry.file}.`);
  }
  const topDep = installed[0];
  if (topDep) {
    if (!topHit) lines.push(`Use ${topDep.dep.name} \u2014 it is already installed.`);
    lines.push(`Do not install another ${topDep.family.label}.`);
  }
  return lines;
}

// src/commands/check.ts
async function check(root, need, opts = {}) {
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
  const result = query(inventory, need, root, opts.top ?? 5);
  console.log(renderCheck(result, opts));
  recordEvent(root, "check", {
    need,
    empty: result.empty,
    topHit: result.code[0]?.entry.file ?? null
  });
  if (!opts.json && existsSync(join(pantryDir(root), "inventory.json"))) {
    const pkgNewer = isPackageJsonNewer(root);
    if (pkgNewer) console.log("\n(package.json changed since the last scan \u2014 run `pantry sync`)");
  }
  return 0;
}
function isPackageJsonNewer(root) {
  try {
    const pkg = statSync(join(root, "package.json")).mtimeMs;
    const inv = statSync(join(pantryDir(root), "inventory.json")).mtimeMs;
    return pkg > inv;
  } catch {
    return false;
  }
}
export {
  check
};
