#!/usr/bin/env node
import {
  require_picocolors
} from "./chunk-COWW6QSR.js";
import {
  loadInventory,
  pantryDir
} from "./chunk-QZWZRDGW.js";
import {
  __toESM
} from "./chunk-FYS2JH42.js";

// src/commands/doctor.ts
var import_picocolors = __toESM(require_picocolors(), 1);
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
async function doctor(root) {
  const color = process.stdout.isTTY;
  const ok = (s) => console.log(`  ${color ? import_picocolors.default.green("\u2713") : "\u2713"} ${s}`);
  const bad = (s) => console.log(`  ${color ? import_picocolors.default.red("\u2717") : "\u2717"} ${s}`);
  const meh = (s) => console.log(`  ${color ? import_picocolors.default.yellow("~") : "~"} ${s}`);
  console.log(color ? import_picocolors.default.bold("\u{1F96B} PANTRY DOCTOR") : "\u{1F96B} PANTRY DOCTOR");
  console.log("");
  const inventory = loadInventory(root);
  if (!inventory) {
    bad("no inventory \u2014 run `pantry init`");
    return 1;
  }
  ok(
    `inventory: ${inventory.entries.length} exports, ${inventory.deps.length} deps (scanned ${inventory.meta.scannedAt.slice(0, 16)})`
  );
  try {
    const pkgM = statSync(join(root, "package.json")).mtimeMs;
    const invM = statSync(join(pantryDir(root), "inventory.json")).mtimeMs;
    if (pkgM > invM) meh("package.json changed since last scan \u2014 run `pantry sync`");
    else ok("inventory is fresh");
  } catch {
    meh("no package.json (source-only mode)");
  }
  if (inventory.meta.parseErrorCount > 0) {
    meh(
      `${inventory.meta.parseErrorCount} file(s) failed to parse (skipped, see .pantry/errors.log)`
    );
  } else {
    ok("no parse errors");
  }
  if (inventory.meta.unresolvedImportCount > 0) {
    meh(
      `${inventory.meta.unresolvedImportCount} imports could not be resolved \u2014 usage counts may undercount (custom aliases?)`
    );
  } else {
    ok("all imports resolved");
  }
  const settingsPath = join(root, ".claude", "settings.json");
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
      const raw = JSON.stringify(settings);
      if (raw.includes("hook pretooluse")) ok("Claude Code install-bouncer wired");
      else
        meh(
          "Claude Code settings exist but pantry hooks aren't wired \u2014 `pantry install claude-code`"
        );
      if (raw.includes("hook sessionstart")) ok("Claude Code session context wired");
    } catch {
      bad(
        ".claude/settings.json is not valid JSON \u2014 fix it by hand, pantry won't touch a broken file"
      );
    }
  } else {
    meh("no Claude Code integration \u2014 `pantry install claude-code` to enforce");
  }
  const skillPath = join(root, ".claude", "skills", "pantry", "SKILL.md");
  if (existsSync(skillPath)) ok("pantry skill in place");
  return 0;
}
export {
  doctor
};
