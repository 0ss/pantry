// PreToolUse install-bouncer. Reads the hook payload on stdin, answers from
// inventory.json (or package.json directly when there's no inventory yet —
// never a source scan), and must stay well under 150ms.
//
// Exit codes: 2 = block the tool call (stderr shown to the agent),
// 0 = let it through. Anything goes wrong → exit 0. A buggy guard that
// wrongly blocks is worse than no guard.

import { readFileSync, statSync } from "node:fs";
import { familyForPackage, loadFamilies } from "../capabilities/match.js";
import { loadAllowList } from "../commands/allow.js";
import { recordEvent } from "../ledger.js";
import { findRepoRoot, loadConfig, loadInventory, logError } from "../paths.js";
import { parseInstallCommand } from "./install-cmd.js";

async function main(): Promise<void> {
  let root = process.cwd();
  try {
    root = findRepoRoot(process.cwd());
    const input = readFileSync(0, "utf8").replace(/^\uFEFF/, ""); // BOM, thanks Windows
    const payload = JSON.parse(input);
    const command: string = payload?.tool_input?.command ?? "";
    if (!command) return;

    const parsed = parseInstallCommand(command);
    if (!parsed || parsed.packages.length === 0) return; // not an install / bare restore

    if (process.env.PANTRY_ALLOW === "1") return;

    const config = loadConfig(root);
    const families = loadFamilies(root);

    // inventory gives usage counts, but the bouncer works without one —
    // plugin just installed, no init yet? read package.json directly.
    const inventory = loadInventory(root);
    let deps = inventory?.deps;
    if (!deps) {
      const { scanDeps } = await import("../scanner/deps.js");
      deps = scanDeps(root, families);
    }
    if (deps.length === 0) return; // nothing installed, nothing to defend

    const allowed = new Set(loadAllowList(root).map((a) => a.pkg));
    const stale = inventory ? isPackageJsonNewer(root) : false;

    for (const pkg of parsed.packages) {
      const family = familyForPackage(pkg, families);
      if (!family) continue;
      if (allowed.has(pkg)) continue;
      // already installed? re-installing/upgrading the same package is fine
      if (deps.some((d) => d.name === pkg)) continue;

      const covering = deps
        .filter((d) => d.family === family.id && !d.dev && d.name !== pkg)
        .sort((a, b) => b.usageCount - a.usageCount)[0];
      if (!covering) continue;

      const usedIn =
        covering.usageCount > 0
          ? `used in ${covering.usageCount} file${covering.usageCount === 1 ? "" : "s"}`
          : "in package.json";
      const lines = [
        `🥫 We have a ${family.label} at home.`,
        "",
        `BLOCKED: ${pkg} — already covered by ${covering.name} (${usedIn}).`,
        `Use ${covering.name}, or: pantry allow ${pkg} --reason "..."  (or PANTRY_ALLOW=1 for this session)`,
      ];
      // point at the code, not just the package — the agent probably wants
      // a helper that already exists
      if (inventory) {
        const { query } = await import("../query/score.js");
        const hit = query(inventory, family.label, root, 1).code[0];
        if (hit) {
          lines.splice(
            3,
            0,
            `Already in the house: ${hit.entry.name}${hit.entry.signature} — ${hit.entry.file}:${hit.entry.line}`,
          );
        }
      }
      if (stale) lines.push("(inventory may be stale — `pantry sync` recommended)");

      if (family.exclusive && config.blockMode !== "warn") {
        process.stderr.write(`${lines.join("\n")}\n`);
        recordEvent(root, "block", { pkg, coveredBy: covering.name, family: family.id, command });
        process.exitCode = 2;
        return;
      }
      // non-exclusive (or warn mode): say it, let it through
      lines[2] = `HEADS-UP: ${pkg} — this repo already has ${covering.name} (${usedIn}, same family: ${family.label}).`;
      process.stderr.write(`${lines.filter((_, i) => i !== 3).join("\n")}\n`);
      recordEvent(root, "warn", { pkg, coveredBy: covering.name, family: family.id, command });
    }
  } catch (err) {
    // fail open, always
    try {
      logError(root, "pretooluse-hook", err);
    } catch {
      /* nothing left to try */
    }
  }
}

function isPackageJsonNewer(root: string): boolean {
  try {
    return (
      statSync(`${root}/package.json`).mtimeMs > statSync(`${root}/.pantry/inventory.json`).mtimeMs
    );
  } catch {
    return false;
  }
}

await main();
