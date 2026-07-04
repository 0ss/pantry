import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadFamilies } from "../capabilities/match.js";
import { ensurePantryDir, loadConfig } from "../paths.js";
import type { Inventory } from "../types.js";

/** ~4 chars per token — close enough to enforce a budget. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Render the agent-facing PANTRY.md. Hard token budget: lowest-usage entries
 * are trimmed first until the whole file fits.
 */
export function summarize(inventory: Inventory, root: string): string {
  const config = loadConfig(root);
  const budget = config.tokenBudget;
  const families = loadFamilies(root);
  const familyById = new Map(families.map((f) => [f.id, f]));

  // installed capability lines (never trimmed — this is the core signal)
  const covered = inventory.deps.filter((d) => d.family && !d.dev);
  const byFamily = new Map<string, typeof covered>();
  for (const dep of covered) {
    const list = byFamily.get(dep.family as string) ?? [];
    list.push(dep);
    byFamily.set(dep.family as string, list);
  }
  const capLines: string[] = [];
  for (const [familyId, deps] of [...byFamily.entries()].sort()) {
    const family = familyById.get(familyId);
    const names = deps
      .map((d) => `${d.name} (${d.usageCount} file${d.usageCount === 1 ? "" : "s"})`)
      .join(", ");
    const others = family?.packages
      .filter((p) => !p.includes("*") && !deps.some((d) => d.name === p))
      .slice(0, 3)
      .join("/");
    const warn = family?.exclusive && others ? ` — do not install ${others}` : "";
    capLines.push(`- ${familyId}: ${names}${warn}`);
  }

  // reusable exports, usage-ranked (the trimmable section)
  const reusables = inventory.entries
    .filter(
      (e) =>
        e.usageCount > 0 &&
        (e.kind === "component" || e.kind === "hook" || e.kind === "util" || e.kind === "schema"),
    )
    .slice(0, 60);

  const render = (entryCount: number): string => {
    const lines = [
      "# 🥫 Pantry — what this repo already has",
      "",
      "Before writing a new component/hook/util/schema or installing a package,",
      'run `pantry check "<need>"` and follow its recommendation.',
      "",
    ];
    if (capLines.length > 0) {
      lines.push("## Installed capabilities", ...capLines, "");
    }
    const shown = reusables.slice(0, entryCount);
    if (shown.length > 0) {
      lines.push("## Top reusables (usage-ranked)");
      for (const e of shown) {
        const sig = e.signature && e.signature !== "()" ? e.signature : "";
        lines.push(`- ${e.name}${sig} — ${e.file} (${e.usageCount} uses, ${e.kind})`);
      }
      lines.push("");
    }
    if (capLines.length === 0 && shown.length === 0) {
      lines.push("Pantry is empty — no reusable exports or mapped dependencies yet.", "");
    }
    lines.push(`_${inventory.meta.fileCount} files scanned. \`pantry sync\` refreshes this._`);
    return lines.join("\n");
  };

  // trim lowest-usage reusables until we fit the budget
  let count = reusables.length;
  let text = render(count);
  while (estimateTokens(text) > budget && count > 0) {
    count = Math.max(0, count - 3);
    text = render(count);
  }
  return text;
}

export function writeSummary(inventory: Inventory, root: string): string {
  const text = summarize(inventory, root);
  ensurePantryDir(root);
  writeFileSync(join(root, ".pantry", "PANTRY.md"), text);
  return text;
}
