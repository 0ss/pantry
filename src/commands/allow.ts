import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensurePantryDir, pantryDir } from "../paths.js";
import type { AllowEntry } from "../types.js";

export function loadAllowList(root: string): AllowEntry[] {
  try {
    const raw = readFileSync(join(pantryDir(root), "allow.json"), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * `pantry allow <pkg> --reason "..."` — permit a deliberate duplicate.
 * allow.json is committed: it doubles as an audit trail of every exception.
 */
export async function allow(root: string, pkg: string, reason: string): Promise<number> {
  if (!reason) {
    console.error("A reason is required — the allow list is an audit trail.");
    console.error(`Try: pantry allow ${pkg} --reason "migrating off moment, tracked in #142"`);
    return 1;
  }
  ensurePantryDir(root);
  const list = loadAllowList(root);
  const existing = list.find((a) => a.pkg === pkg);
  if (existing) {
    existing.reason = reason;
    existing.date = new Date().toISOString().slice(0, 10);
  } else {
    list.push({ pkg, reason, date: new Date().toISOString().slice(0, 10) });
  }
  writeFileSync(join(pantryDir(root), "allow.json"), `${JSON.stringify(list, null, 2)}\n`);
  console.log(`🥫 ${pkg} allowed: "${reason}"`);
  console.log("Recorded in .pantry/allow.json — commit it.");
  return 0;
}
