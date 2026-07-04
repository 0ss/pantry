import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { loadInventory, pantryDir } from "../paths.js";

// quick "is everything wired" checklist. exit 1 only if there's no inventory at all.
export async function doctor(root: string): Promise<number> {
  const color = process.stdout.isTTY;
  const ok = (s: string) => console.log(`  ${color ? pc.green("✓") : "✓"} ${s}`);
  const bad = (s: string) => console.log(`  ${color ? pc.red("✗") : "✗"} ${s}`);
  const meh = (s: string) => console.log(`  ${color ? pc.yellow("~") : "~"} ${s}`);

  console.log(color ? pc.bold("🥫 PANTRY DOCTOR") : "🥫 PANTRY DOCTOR");
  console.log("");

  const inventory = loadInventory(root);
  if (!inventory) {
    bad("no inventory — run `pantry init`");
    return 1;
  }
  ok(
    `inventory: ${inventory.entries.length} exports, ${inventory.deps.length} deps (scanned ${inventory.meta.scannedAt.slice(0, 16)})`,
  );

  // freshness: package.json newer than the scan?
  try {
    const pkgM = statSync(join(root, "package.json")).mtimeMs;
    const invM = statSync(join(pantryDir(root), "inventory.json")).mtimeMs;
    if (pkgM > invM) meh("package.json changed since last scan — run `pantry sync`");
    else ok("inventory is fresh");
  } catch {
    meh("no package.json (source-only mode)");
  }

  if (inventory.meta.parseErrorCount > 0) {
    meh(
      `${inventory.meta.parseErrorCount} file(s) failed to parse (skipped, see .pantry/errors.log)`,
    );
  } else {
    ok("no parse errors");
  }

  if (inventory.meta.unresolvedImportCount > 0) {
    meh(
      `${inventory.meta.unresolvedImportCount} imports could not be resolved — usage counts may undercount (custom aliases?)`,
    );
  } else {
    ok("all imports resolved");
  }

  // hooks wired?
  const settingsPath = join(root, ".claude", "settings.json");
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
      const raw = JSON.stringify(settings);
      if (raw.includes("hook pretooluse")) ok("Claude Code install-bouncer wired");
      else
        meh(
          "Claude Code settings exist but pantry hooks aren't wired — `pantry install claude-code`",
        );
      if (raw.includes("hook sessionstart")) ok("Claude Code session context wired");
    } catch {
      bad(
        ".claude/settings.json is not valid JSON — fix it by hand, pantry won't touch a broken file",
      );
    }
  } else {
    meh("no Claude Code integration — `pantry install claude-code` to enforce");
  }

  const skillPath = join(root, ".claude", "skills", "pantry", "SKILL.md");
  if (existsSync(skillPath)) ok("pantry skill in place");

  return 0;
}
