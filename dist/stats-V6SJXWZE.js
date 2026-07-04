#!/usr/bin/env node
import {
  require_picocolors
} from "./chunk-COWW6QSR.js";
import {
  readLedger
} from "./chunk-ERKV7XNB.js";
import {
  loadInventory
} from "./chunk-QZWZRDGW.js";
import {
  __toESM
} from "./chunk-FYS2JH42.js";

// src/commands/stats.ts
var import_picocolors = __toESM(require_picocolors(), 1);
async function stats(root, opts = {}) {
  const events = readLedger(root);
  const blocks = events.filter((e) => e.event === "block");
  const warns = events.filter((e) => e.event === "warn");
  const checks = events.filter((e) => e.event === "check");
  const hitCounts = /* @__PURE__ */ new Map();
  for (const e of checks) {
    const hit = e.detail?.topHit;
    if (typeof hit === "string") hitCounts.set(hit, (hitCounts.get(hit) ?? 0) + 1);
  }
  const topReused = [...hitCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const emptyChecks = checks.filter((e) => e.detail?.empty === true).length;
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          installsBlocked: blocks.length,
          installWarnings: warns.length,
          checksRun: checks.length,
          emptyPantryAnswers: emptyChecks,
          topReused: topReused.map(([file, count]) => ({ file, count }))
        },
        null,
        2
      )
    );
    return 0;
  }
  const color = process.stdout.isTTY;
  const bold = (s) => color ? import_picocolors.default.bold(s) : s;
  const green = (s) => color ? import_picocolors.default.green(s) : s;
  const dim = (s) => color ? import_picocolors.default.dim(s) : s;
  console.log(bold("\u{1F96B} PANTRY STATS"));
  console.log("");
  console.log(`  ${green(String(blocks.length).padStart(4))}  installs blocked`);
  console.log(`  ${String(warns.length).padStart(4)}  install warnings`);
  console.log(`  ${String(checks.length).padStart(4)}  pantry checks run`);
  if (checks.length > 0) {
    console.log(`  ${String(emptyChecks).padStart(4)}  honest "pantry is empty" answers`);
  }
  if (blocks.length > 0) {
    console.log("");
    console.log(bold("  Blocked at the door:"));
    const blockedPkgs = /* @__PURE__ */ new Map();
    for (const b of blocks) {
      const pkg = typeof b.detail?.pkg === "string" ? b.detail.pkg : "?";
      blockedPkgs.set(pkg, (blockedPkgs.get(pkg) ?? 0) + 1);
    }
    for (const [pkg, count] of [...blockedPkgs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`    ${pkg}${count > 1 ? dim(` \xD7${count}`) : ""}`);
    }
  }
  if (topReused.length > 0) {
    console.log("");
    console.log(bold("  Most pointed-at modules:"));
    for (const [file, count] of topReused) {
      console.log(`    ${file} ${dim(`(${count} check${count === 1 ? "" : "s"})`)}`);
    }
  }
  if (events.length === 0) {
    const inv = loadInventory(root);
    console.log("");
    console.log(
      inv ? "  Nothing logged yet. Give it a week." : "  No pantry here yet \u2014 run `pantry init`."
    );
  }
  return 0;
}
export {
  stats
};
