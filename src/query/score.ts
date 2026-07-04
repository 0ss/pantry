import { expandNeed, familiesForNeed, loadFamilies, tokenize } from "../capabilities/match.js";
import type { CapabilityFamily, DepEntry, Inventory, InventoryEntry } from "../types.js";

export interface ScoredEntry {
  entry: InventoryEntry;
  score: number;
}

export interface QueryResult {
  need: string;
  /** Installed deps whose capability family matches the need. */
  installed: Array<{ dep: DepEntry; family: CapabilityFamily }>;
  /** Existing code, best first. */
  code: ScoredEntry[];
  /** Top importer files of the #1 code hit. */
  usedIn: string[];
  /** Rule-based imperative recommendation lines. */
  recommendation: string[];
  empty: boolean;
}

/** Entries scoring below this are noise, not answers. */
const SCORE_FLOOR = 40;

/**
 * Deterministic ranking. Same inventory + same need → same output, always.
 * exact name 100 · name prefix 60 · family/synonym 50 · path segment 40 ·
 * JSDoc hit 20, multiplied by 1 + log10(1 + usageCount).
 */
export function query(inventory: Inventory, need: string, root?: string, top = 5): QueryResult {
  const families = loadFamilies(root);
  const needTokens = tokenize(need);
  const expanded = expandNeed(need, families);
  const needFamilies = familiesForNeed(need, families);
  const needFamilyIds = new Set(needFamilies.map((f) => f.id));

  const installed = inventory.deps
    .filter((d) => d.family && needFamilyIds.has(d.family) && !d.dev)
    .map((dep) => ({
      dep,
      family: needFamilies.find((f) => f.id === dep.family) as CapabilityFamily,
    }))
    .sort((a, b) => b.dep.usageCount - a.dep.usageCount);

  const scored: ScoredEntry[] = [];
  for (const entry of inventory.entries) {
    const score = scoreEntry(entry, needTokens, expanded, needFamilyIds);
    if (score >= SCORE_FLOOR) scored.push({ entry, score });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.entry.file.localeCompare(b.entry.file) ||
      a.entry.name.localeCompare(b.entry.name),
  );
  const code = scored.slice(0, top);

  const empty = installed.length === 0 && code.length === 0;
  return {
    need,
    installed,
    code,
    usedIn: code[0]?.entry.topImporters ?? [],
    recommendation: buildRecommendation(installed, code),
    empty,
  };
}

function scoreEntry(
  entry: InventoryEntry,
  needTokens: string[],
  expanded: string[],
  needFamilyIds: Set<string>,
): number {
  const nameLower = entry.name.toLowerCase();
  const nameTokens = splitIdentifier(entry.name);
  let base = 0;

  // exact name match: the whole need (or a need token) equals the identifier
  if (needTokens.includes(nameLower) || needTokens.join("") === nameLower) base = 100;
  // name prefix / token overlap: "formatDate" hits need tokens [format, date]
  else if (nameTokens.some((t) => needTokens.includes(t))) {
    const overlap = nameTokens.filter((t) => needTokens.includes(t)).length;
    base = overlap >= 2 ? 90 : 60;
  } else if (expanded.some((t) => nameLower.startsWith(t) || nameTokens.includes(t))) {
    base = 50; // family/synonym match
  }

  // path segment match
  const pathTokens = entry.file.toLowerCase().split(/[/.\-_]/);
  if (pathTokens.some((seg) => needTokens.includes(seg) || expanded.includes(seg))) {
    base = Math.max(base, 40);
  }

  // JSDoc hit
  if (entry.doc) {
    const docTokens = tokenize(entry.doc);
    if (needTokens.some((t) => docTokens.includes(t))) base += 20;
  }

  if (base === 0) return 0;
  // a type alias named DurationPreset shouldn't outrank an actual
  // formatDate() — callable things are what "do we have X" means
  const kindWeight = entry.kind === "type" || entry.kind === "constant" ? 0.5 : 1;
  return base * kindWeight * (1 + Math.log10(1 + entry.usageCount));
}

/** "formatRelativeTime" → ["format", "relative", "time"]. */
export function splitIdentifier(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function buildRecommendation(installed: QueryResult["installed"], code: ScoredEntry[]): string[] {
  const lines: string[] = [];
  const topHit = code[0];
  if (topHit) {
    lines.push(`Reuse ${topHit.entry.file}.`);
  }
  const topDep = installed[0];
  if (topDep) {
    if (!topHit) lines.push(`Use ${topDep.dep.name} — it is already installed.`);
    lines.push(`Do not install another ${topDep.family.label}.`);
  }
  return lines;
}
