import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ensurePantryDir, pantryDir } from "./paths.js";
import type { LedgerEvent } from "./types.js";

/** Append one event. Never throws — the ledger is best-effort. */
export function recordEvent(
  root: string,
  event: LedgerEvent["event"],
  detail: Record<string, unknown>,
): void {
  try {
    ensurePantryDir(root);
    const line = `${JSON.stringify({ ts: new Date().toISOString(), event, detail })}\n`;
    appendFileSync(join(pantryDir(root), "ledger.jsonl"), line);
  } catch {
    // stats are a nice-to-have, never a blocker
  }
}

export function readLedger(root: string): LedgerEvent[] {
  try {
    const raw = readFileSync(join(pantryDir(root), "ledger.jsonl"), "utf8");
    const events: LedgerEvent[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        // skip torn lines
      }
    }
    return events;
  } catch {
    return [];
  }
}
