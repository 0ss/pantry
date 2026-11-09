// statusline badge: a tiny permanent scoreboard in the corner of the
// session. 🥫 means pantry's watching, the number is installs bounced.
// reads the ledger, prints one line, never errors loudly.

import { findRepoRoot } from "../paths.js";
import { readLedger } from "../ledger.js";

try {
  const root = findRepoRoot(process.cwd());
  const events = readLedger(root);
  const blocks = events.filter((e) => e.event === "block").length;
  process.stdout.write(blocks > 0 ? `🥫 ${blocks} blocked` : "🥫 pantry");
} catch {
  process.stdout.write("🥫 pantry");
}
