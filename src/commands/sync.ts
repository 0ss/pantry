import pc from "picocolors";
import { buildInventory } from "../inventory/build.js";
import { writeSummary } from "../inventory/summarize.js";
import { recordEvent } from "../ledger.js";
import { saveInventory } from "../paths.js";

/** Incremental re-index: unchanged files come from the mtime/size cache. */
export async function sync(root: string, opts: { quiet?: boolean } = {}): Promise<number> {
  const started = Date.now();
  const { inventory, parsedCount } = await buildInventory(root);
  saveInventory(root, inventory);
  writeSummary(inventory, root);
  recordEvent(root, "sync", { parsedCount });
  if (!opts.quiet) {
    console.log(
      `🥫 Pantry synced: ${inventory.meta.fileCount} files (${parsedCount} re-parsed) in ${pc.bold(`${Date.now() - started}ms`)}`,
    );
  }
  return 0;
}
