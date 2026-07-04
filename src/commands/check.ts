import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { recordEvent } from "../ledger.js";
import { loadInventory, pantryDir } from "../paths.js";
import { renderCheck } from "../query/render.js";
import { query } from "../query/score.js";

export interface CheckOptions {
  json?: boolean;
  plain?: boolean;
  top?: number;
}

/** `pantry check "<need>"` — informational, always exit 0. */
export async function check(root: string, need: string, opts: CheckOptions = {}): Promise<number> {
  let inventory = loadInventory(root);
  if (!inventory) {
    // first run without init: stock the pantry, then answer
    if (!opts.json) console.error("(no inventory yet — running pantry init first)");
    const { init } = await import("./init.js");
    await init(root, { quiet: true });
    inventory = loadInventory(root);
    if (!inventory) {
      console.error("Could not build an inventory here.");
      console.error("Run `pantry init` in the repo root and check .pantry/errors.log.");
      return 1;
    }
  }

  const result = query(inventory, need, root, opts.top ?? 5);
  console.log(renderCheck(result, opts));
  recordEvent(root, "check", {
    need,
    empty: result.empty,
    topHit: result.code[0]?.entry.file ?? null,
  });

  // nudge when the inventory looks stale (informational, never blocks)
  if (!opts.json && existsSync(join(pantryDir(root), "inventory.json"))) {
    const pkgNewer = isPackageJsonNewer(root);
    if (pkgNewer) console.log("\n(package.json changed since the last scan — run `pantry sync`)");
  }
  return 0;
}

function isPackageJsonNewer(root: string): boolean {
  try {
    const pkg = statSync(join(root, "package.json")).mtimeMs;
    const inv = statSync(join(pantryDir(root), "inventory.json")).mtimeMs;
    return pkg > inv;
  } catch {
    return false;
  }
}
