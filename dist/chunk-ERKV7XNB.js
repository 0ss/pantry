#!/usr/bin/env node
import {
  ensurePantryDir,
  pantryDir
} from "./chunk-QZWZRDGW.js";

// src/ledger.ts
import { appendFileSync, readFileSync } from "fs";
import { join } from "path";
function recordEvent(root, event, detail) {
  try {
    ensurePantryDir(root);
    const line = `${JSON.stringify({ ts: (/* @__PURE__ */ new Date()).toISOString(), event, detail })}
`;
    appendFileSync(join(pantryDir(root), "ledger.jsonl"), line);
  } catch {
  }
}
function readLedger(root) {
  try {
    const raw = readFileSync(join(pantryDir(root), "ledger.jsonl"), "utf8");
    const events = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
      }
    }
    return events;
  } catch {
    return [];
  }
}

export {
  recordEvent,
  readLedger
};
