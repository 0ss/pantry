import pc from "picocolors";
import { readLedger } from "../ledger.js";
import { loadInventory } from "../paths.js";

// the screenshot command — keep it pretty
export async function stats(root: string, opts: { json?: boolean } = {}): Promise<number> {
  const events = readLedger(root);
  const blocks = events.filter((e) => e.event === "block");
  const warns = events.filter((e) => e.event === "warn");
  const checks = events.filter((e) => e.event === "check");

  // which files does check keep pointing people at?
  const hitCounts = new Map<string, number>();
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
          topReused: topReused.map(([file, count]) => ({ file, count })),
        },
        null,
        2,
      ),
    );
    return 0;
  }

  const color = process.stdout.isTTY;
  const bold = (s: string) => (color ? pc.bold(s) : s);
  const green = (s: string) => (color ? pc.green(s) : s);
  const dim = (s: string) => (color ? pc.dim(s) : s);

  console.log(bold("🥫 PANTRY STATS"));
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
    const blockedPkgs = new Map<string, number>();
    for (const b of blocks) {
      const pkg = typeof b.detail?.pkg === "string" ? b.detail.pkg : "?";
      blockedPkgs.set(pkg, (blockedPkgs.get(pkg) ?? 0) + 1);
    }
    for (const [pkg, count] of [...blockedPkgs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`    ${pkg}${count > 1 ? dim(` ×${count}`) : ""}`);
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
      inv ? "  Nothing logged yet. Give it a week." : "  No pantry here yet — run `pantry init`.",
    );
  }
  return 0;
}
