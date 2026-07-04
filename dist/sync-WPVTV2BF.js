#!/usr/bin/env node
import {
  buildInventory,
  writeSummary
} from "./chunk-GITDU6W6.js";
import {
  require_picocolors
} from "./chunk-COWW6QSR.js";
import {
  recordEvent
} from "./chunk-ERKV7XNB.js";
import {
  saveInventory
} from "./chunk-QZWZRDGW.js";
import "./chunk-B2O5OO6M.js";
import "./chunk-7SK2TDUQ.js";
import {
  __toESM
} from "./chunk-FYS2JH42.js";

// src/commands/sync.ts
var import_picocolors = __toESM(require_picocolors(), 1);
async function sync(root, opts = {}) {
  const started = Date.now();
  const { inventory, parsedCount } = await buildInventory(root);
  saveInventory(root, inventory);
  writeSummary(inventory, root);
  recordEvent(root, "sync", { parsedCount });
  if (!opts.quiet) {
    console.log(
      `\u{1F96B} Pantry synced: ${inventory.meta.fileCount} files (${parsedCount} re-parsed) in ${import_picocolors.default.bold(`${Date.now() - started}ms`)}`
    );
  }
  return 0;
}
export {
  sync
};
