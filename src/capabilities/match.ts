import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CapabilityFamily } from "../types.js";
import table from "./table.json" with { type: "json" };

let cachedFamilies: CapabilityFamily[] | null = null;

/** All families: built-in table plus any extras from .pantry/config.json. */
export function loadFamilies(repoRoot?: string): CapabilityFamily[] {
  if (cachedFamilies && !repoRoot) return cachedFamilies;
  const families = [...(table.families as CapabilityFamily[])];
  if (repoRoot) {
    try {
      const raw = readFileSync(join(repoRoot, ".pantry", "config.json"), "utf8");
      const config = JSON.parse(raw);
      if (Array.isArray(config.extraCapabilities)) families.push(...config.extraCapabilities);
    } catch {
      // no config or malformed — built-in table only
    }
  } else {
    cachedFamilies = families;
  }
  return families;
}

/** Does `pkg` belong to this family? Handles trailing-`*` prefix wildcards. */
function pkgMatches(pkg: string, pattern: string): boolean {
  if (pattern.endsWith("*")) return pkg.startsWith(pattern.slice(0, -1));
  return pkg === pattern;
}

/** Map a package name to its capability family, or null. */
export function familyForPackage(
  pkg: string,
  families: CapabilityFamily[],
): CapabilityFamily | null {
  for (const family of families) {
    if (family.packages.some((p) => pkgMatches(pkg, p))) return family;
  }
  return null;
}

/** Which table pattern matched this package ("@radix-ui/*", "moment", …). */
export function matchedPattern(pkg: string, family: CapabilityFamily): string | null {
  return family.packages.find((p) => pkgMatches(pkg, p)) ?? null;
}

/** Families whose id, label, or synonyms overlap the tokenized need. */
export function familiesForNeed(need: string, families: CapabilityFamily[]): CapabilityFamily[] {
  const needLower = need.toLowerCase();
  const tokens = tokenize(needLower);
  const hits: CapabilityFamily[] = [];
  for (const family of families) {
    const candidates = [family.id, family.label, ...family.synonyms].map((s) => s.toLowerCase());
    const hit = candidates.some((c) => {
      const candidateTokens = tokenize(c);
      if (candidateTokens.length === 0) return false;
      // multi-word candidates may match as a phrase; single words must match
      // a whole token ("form" must not hit inside "formatting")
      if (candidateTokens.length > 1 && needLower.includes(c)) return true;
      return candidateTokens.every((t) => tokens.includes(t));
    });
    if (hit) hits.push(family);
  }
  return hits;
}

/** Synonym expansion for the query engine: need → extra search tokens. */
export function expandNeed(need: string, families: CapabilityFamily[]): string[] {
  const tokens = new Set(tokenize(need.toLowerCase()));
  for (const family of familiesForNeed(need, families)) {
    tokens.add(family.id);
    for (const syn of family.synonyms) for (const t of tokenize(syn)) tokens.add(t);
  }
  return [...tokens];
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "for",
  "to",
  "in",
  "on",
  "and",
  "or",
  "with",
  "my",
  "our",
]);
