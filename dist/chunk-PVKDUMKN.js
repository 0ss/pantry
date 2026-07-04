#!/usr/bin/env node
import {
  ensurePantryDir,
  pantryDir
} from "./chunk-QZWZRDGW.js";

// src/commands/allow.ts
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
function loadAllowList(root) {
  try {
    const raw = readFileSync(join(pantryDir(root), "allow.json"), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
async function allow(root, pkg, reason) {
  if (!reason) {
    console.error("A reason is required \u2014 the allow list is an audit trail.");
    console.error(`Try: pantry allow ${pkg} --reason "migrating off moment, tracked in #142"`);
    return 1;
  }
  ensurePantryDir(root);
  const list = loadAllowList(root);
  const existing = list.find((a) => a.pkg === pkg);
  if (existing) {
    existing.reason = reason;
    existing.date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  } else {
    list.push({ pkg, reason, date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) });
  }
  writeFileSync(join(pantryDir(root), "allow.json"), `${JSON.stringify(list, null, 2)}
`);
  console.log(`\u{1F96B} ${pkg} allowed: "${reason}"`);
  console.log("Recorded in .pantry/allow.json \u2014 commit it.");
  return 0;
}

export {
  loadAllowList,
  allow
};
