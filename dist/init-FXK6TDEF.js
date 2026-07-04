#!/usr/bin/env node
import {
  buildInventory,
  writeSummary
} from "./chunk-CAWQBXNN.js";
import {
  require_picocolors
} from "./chunk-COWW6QSR.js";
import {
  recordEvent
} from "./chunk-ERKV7XNB.js";
import {
  DEFAULT_CONFIG,
  ensurePantryDir,
  saveInventory
} from "./chunk-QZWZRDGW.js";
import "./chunk-ZACRB6CS.js";
import {
  loadFamilies
} from "./chunk-DID37CC6.js";
import {
  __toESM
} from "./chunk-FYS2JH42.js";

// src/commands/init.ts
var import_picocolors = __toESM(require_picocolors(), 1);
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
async function init(root, opts = {}) {
  const dir = ensurePantryDir(root);
  const configPath = join(dir, "config.json");
  if (!existsSync(configPath)) {
    writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}
`);
  }
  const gitignorePath = join(dir, ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(
      gitignorePath,
      "inventory.json\ncache.json\nledger.jsonl\nerrors.log\nbackups/\n"
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
  const coveredFamilies = /* @__PURE__ */ new Map();
  for (const dep of inventory.deps) {
    if (!dep.family || dep.dev) continue;
    coveredFamilies.set(dep.family, [...coveredFamilies.get(dep.family) ?? [], dep.name]);
  }
  const duplicates = [...coveredFamilies.entries()].filter(
    ([id, pkgs]) => pkgs.length > 1 && familyById.get(id)?.exclusive
  );
  const top = inventory.entries.filter((e) => e.usageCount > 0 && e.kind !== "type" && e.kind !== "constant").slice(0, 3);
  console.log(import_picocolors.default.bold("\u{1F96B} Pantry stocked."));
  console.log(`   ${inventory.meta.fileCount} files scanned in ${Date.now() - started}ms`);
  console.log(
    `   ${inventory.entries.length} exports indexed, ${inventory.deps.length} deps mapped`
  );
  console.log(`   ${coveredFamilies.size} capability families covered`);
  if (top.length > 0) {
    console.log("   Top reusables:");
    for (const e of top) console.log(`     ${e.name} \u2014 ${e.file} (${e.usageCount} uses)`);
  }
  if (duplicates.length > 0) {
    console.log(
      import_picocolors.default.yellow(
        `   \u26A0 ${duplicates.length} duplicated famil${duplicates.length === 1 ? "y" : "ies"} \u2014 run \`pantry audit\``
      )
    );
  }
  console.log(`   Wire it up: ${import_picocolors.default.cyan("pantry install claude-code")}`);
  return 0;
}
export {
  init
};
