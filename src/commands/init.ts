import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { loadFamilies } from "../capabilities/match.js";
import { buildInventory } from "../inventory/build.js";
import { writeSummary } from "../inventory/summarize.js";
import { recordEvent } from "../ledger.js";
import { DEFAULT_CONFIG, ensurePantryDir, saveInventory } from "../paths.js";

/** Scan the repo, write .pantry/{inventory.json, PANTRY.md, config.json}. */
export async function init(root: string, opts: { quiet?: boolean } = {}): Promise<number> {
  const dir = ensurePantryDir(root);
  const configPath = join(dir, "config.json");
  if (!existsSync(configPath)) {
    writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  }
  const gitignorePath = join(dir, ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(
      gitignorePath,
      "inventory.json\ncache.json\nledger.jsonl\nerrors.log\nbackups/\n",
    );
  }

  const started = Date.now();
  const { inventory } = await buildInventory(root);
  saveInventory(root, inventory);
  writeSummary(inventory, root);
  recordEvent(root, "init", { fileCount: inventory.meta.fileCount });

  if (opts.quiet) return 0;

  const families = loadFamilies(root);
  const familyById = new Map(families.map((f) => [f.id, f]));
  const coveredFamilies = new Map<string, string[]>();
  for (const dep of inventory.deps) {
    if (!dep.family || dep.dev) continue;
    coveredFamilies.set(dep.family, [...(coveredFamilies.get(dep.family) ?? []), dep.name]);
  }
  const duplicates = [...coveredFamilies.entries()].filter(
    ([id, pkgs]) => pkgs.length > 1 && familyById.get(id)?.exclusive,
  );
  // types/constants aren't "reusables" in the pitch sense
  const top = inventory.entries
    .filter((e) => e.usageCount > 0 && e.kind !== "type" && e.kind !== "constant")
    .slice(0, 3);

  console.log(pc.bold("🥫 Pantry stocked."));
  console.log(`   ${inventory.meta.fileCount} files scanned in ${Date.now() - started}ms`);
  console.log(
    `   ${inventory.entries.length} exports indexed, ${inventory.deps.length} deps mapped`,
  );
  console.log(`   ${coveredFamilies.size} capability families covered`);
  if (top.length > 0) {
    console.log("   Top reusables:");
    for (const e of top) console.log(`     ${e.name} — ${e.file} (${e.usageCount} uses)`);
  }
  if (duplicates.length > 0) {
    console.log(
      pc.yellow(
        `   ⚠ ${duplicates.length} duplicated famil${duplicates.length === 1 ? "y" : "ies"} — run \`pantry audit\``,
      ),
    );
  }
  console.log(`   Wire it up: ${pc.cyan("pantry install claude-code")}`);
  return 0;
}
