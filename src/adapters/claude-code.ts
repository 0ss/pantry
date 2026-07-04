// Claude Code wiring: settings.json hooks + the skill file.
// Rules learned the hard way (by other projects): back up before touching,
// merge don't clobber, validate before writing (Claude Code drops the whole
// settings file if one hook entry is malformed), and uninstall removes
// exactly what install added — nothing else.

import { execSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensurePantryDir } from "../paths.js";

// the marker is the suffix — the prefix varies (global `pantry` vs an
// absolute node+script path when pantry isn't on PATH)
export const HOOK_MARKERS = {
  pretooluse: "hook pretooluse",
  sessionstart: "hook sessionstart",
} as const;

// paths that end up inside a settings.json command string get shell-expanded
// when the hook fires, so anything outside this set is a no-go
const SHELL_SAFE = /^[A-Za-z0-9 _.\-:/\\~+@]+$/;

/** `pantry` if it resolves on PATH, otherwise pin absolute paths so GUI-launched sessions still work. */
export function hookCommandPrefix(): string {
  try {
    execSync(process.platform === "win32" ? "where pantry" : "command -v pantry", {
      stdio: "ignore",
    });
    return "pantry";
  } catch {
    const script = process.argv[1] ?? "";
    // a hostile-looking path never gets embedded in a command we write.
    // fall back to the bare name, doctor will flag it if it's not on PATH
    if (!SHELL_SAFE.test(script) || !SHELL_SAFE.test(process.execPath)) return "pantry";
    return `"${process.execPath}" "${script}"`;
  }
}

interface InstallManifest {
  settingsPath: string;
  backupPath: string | null;
  settingsExistedBefore: boolean;
  skillPath: string;
  installedAt: string;
}

interface Report {
  lines: string[];
}

// biome-ignore lint/suspicious/noExplicitAny: settings.json is user-owned JSON
type Settings = Record<string, any>;

export function installClaudeCode(root: string, opts: { hookPrefix?: string } = {}): Report {
  const hookPrefix = opts.hookPrefix ?? hookCommandPrefix();
  const report: Report = { lines: [] };
  const claudeDir = join(root, ".claude");
  const settingsPath = join(claudeDir, "settings.json");
  const skillPath = join(claudeDir, "skills", "pantry", "SKILL.md");
  const backupsDir = join(ensurePantryDir(root), "backups");
  mkdirSync(backupsDir, { recursive: true });

  // -- settings.json --
  const settingsExistedBefore = existsSync(settingsPath);
  let settings: Settings = {};
  let backupPath: string | null = null;

  if (settingsExistedBefore) {
    const raw = readFileSync(settingsPath, "utf8");
    try {
      settings = JSON.parse(raw);
    } catch {
      report.lines.push(`✗ ${rel(root, settingsPath)} is not valid JSON — not touching it.`);
      report.lines.push("  Fix it (or delete it) and re-run pantry install claude-code.");
      return report;
    }
    backupPath = join(backupsDir, `settings.json.${timestamp()}.bak`);
    copyFileSync(settingsPath, backupPath);
    report.lines.push(`• backed up settings.json → ${rel(root, backupPath)}`);
  }

  const changed = addHooks(settings, hookPrefix);
  if (changed) {
    mkdirSync(claudeDir, { recursive: true });
    writeSettingsAtomic(settingsPath, settings);
    report.lines.push(
      `✓ ${rel(root, settingsPath)} — PreToolUse (install-bouncer) + SessionStart (context) wired`,
    );
  } else {
    report.lines.push(`• ${rel(root, settingsPath)} — hooks already wired, unchanged`);
    // no point keeping a backup of a file we didn't change
    if (backupPath) {
      unlinkSync(backupPath);
      backupPath = null;
      report.lines.pop();
      report.lines.pop();
      report.lines.push(`• ${rel(root, settingsPath)} — hooks already wired, unchanged`);
    }
  }

  // -- skill --
  const skillSource = findSkillSource();
  if (skillSource) {
    if (
      existsSync(skillPath) &&
      readFileSync(skillPath, "utf8") === readFileSync(skillSource, "utf8")
    ) {
      report.lines.push(`• ${rel(root, skillPath)} — already in place, unchanged`);
    } else {
      mkdirSync(dirname(skillPath), { recursive: true });
      copyFileSync(skillSource, skillPath);
      report.lines.push(`✓ ${rel(root, skillPath)} — pantry skill placed`);
    }
  } else {
    report.lines.push(
      "✗ could not locate the bundled SKILL.md — skill not installed (hooks still work)",
    );
  }

  // -- manifest (what uninstall reads) --
  const manifest: InstallManifest = {
    settingsPath,
    backupPath,
    settingsExistedBefore,
    skillPath,
    installedAt: new Date().toISOString(),
  };
  writeFileSync(
    join(backupsDir, "install-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  return report;
}

export function uninstallClaudeCode(root: string): Report {
  const report: Report = { lines: [] };
  const claudeDir = join(root, ".claude");
  const settingsPath = join(claudeDir, "settings.json");
  const skillPath = join(claudeDir, "skills", "pantry", "SKILL.md");
  const backupsDir = join(root, ".pantry", "backups");

  let manifest: InstallManifest | null = null;
  try {
    manifest = JSON.parse(readFileSync(join(backupsDir, "install-manifest.json"), "utf8"));
  } catch {
    // no manifest — fall back to marker-based removal below
  }

  // -- settings.json --
  if (existsSync(settingsPath)) {
    let settings: Settings | null = null;
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    } catch {
      report.lines.push(`✗ ${rel(root, settingsPath)} is not valid JSON — leaving it alone.`);
    }
    if (settings) {
      const stripped = removeHooks(settings);
      const backup = manifest?.backupPath;
      if (
        backup &&
        existsSync(backup) &&
        deepEqual(stripped, JSON.parse(readFileSync(backup, "utf8")))
      ) {
        // nothing changed since install besides our hooks → restore the exact bytes
        copyFileSync(backup, settingsPath);
        report.lines.push(
          `✓ ${rel(root, settingsPath)} — restored from ${rel(root, backup)} (byte-identical)`,
        );
      } else if (manifest && !manifest.settingsExistedBefore && isEmptySettings(stripped)) {
        unlinkSync(settingsPath);
        report.lines.push(`✓ ${rel(root, settingsPath)} — removed (we created it)`);
      } else {
        writeSettingsAtomic(settingsPath, stripped);
        report.lines.push(
          `✓ ${rel(root, settingsPath)} — pantry hooks removed, your settings kept`,
        );
      }
    }
  } else {
    report.lines.push(`• ${rel(root, settingsPath)} — not present`);
  }

  // -- skill --
  if (existsSync(skillPath)) {
    unlinkSync(skillPath);
    report.lines.push(`✓ ${rel(root, skillPath)} — removed`);
    // tidy empty dirs, but never force
    for (const dir of [dirname(skillPath), dirname(dirname(skillPath))]) {
      try {
        rmdirSync(dir);
      } catch {
        break; // not empty, that's fine
      }
    }
  } else {
    report.lines.push(`• ${rel(root, skillPath)} — not present`);
  }

  return report;
}

// -- helpers --

function addHooks(settings: Settings, prefix: string): boolean {
  settings.hooks ??= {};
  let changed = false;

  const wanted = [
    {
      event: "PreToolUse",
      marker: HOOK_MARKERS.pretooluse,
      entry: {
        matcher: "Bash",
        hooks: [{ type: "command", command: `${prefix} ${HOOK_MARKERS.pretooluse}`, timeout: 10 }],
      },
    },
    {
      event: "SessionStart",
      marker: HOOK_MARKERS.sessionstart,
      entry: {
        hooks: [
          { type: "command", command: `${prefix} ${HOOK_MARKERS.sessionstart}`, timeout: 10 },
        ],
      },
    },
  ];

  for (const { event, marker, entry } of wanted) {
    settings.hooks[event] ??= [];
    const already = JSON.stringify(settings.hooks[event]).includes(marker);
    if (!already) {
      settings.hooks[event].push(entry);
      changed = true;
    }
  }
  return changed;
}

function removeHooks(settings: Settings): Settings {
  const out = structuredClone(settings);
  if (!out.hooks) return out;
  for (const event of Object.keys(out.hooks)) {
    if (!Array.isArray(out.hooks[event])) continue;
    out.hooks[event] = out.hooks[event].filter((group: unknown) => {
      // match on our command suffix, not the word "pantry" — a user hook
      // that happens to mention pantry survives
      const commands = extractCommands(group);
      return !commands.some(
        (c) =>
          c.endsWith(` ${HOOK_MARKERS.pretooluse}`) || c.endsWith(` ${HOOK_MARKERS.sessionstart}`),
      );
    });
    if (out.hooks[event].length === 0) delete out.hooks[event];
  }
  // biome-ignore lint/performance/noDelete: the key must actually vanish from the JSON we write back
  if (Object.keys(out.hooks).length === 0) delete out.hooks;
  return out;
}

function extractCommands(group: unknown): string[] {
  if (!group || typeof group !== "object") return [];
  const hooks = (group as Settings).hooks;
  if (!Array.isArray(hooks)) return [];
  return hooks.map((h) => (typeof h?.command === "string" ? h.command : "")).filter(Boolean);
}

/** Claude Code silently drops settings.json if a hook entry is malformed, so check our own work before writing. */
function validateHooks(settings: Settings): void {
  if (!settings.hooks) return;
  for (const [event, groups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(groups)) throw new Error(`hooks.${event} is not an array`);
    for (const group of groups) {
      const hooks = (group as Settings)?.hooks;
      if (!Array.isArray(hooks)) throw new Error(`hooks.${event} entry missing hooks array`);
      for (const h of hooks) {
        if (h?.type !== "command" || typeof h?.command !== "string" || !h.command) {
          throw new Error(`hooks.${event} has a malformed command hook`);
        }
      }
    }
  }
}

function writeSettingsAtomic(path: string, settings: Settings): void {
  validateHooks(settings);
  const tmp = `${path}.pantry-tmp`;
  writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`);
  renameSync(tmp, path);
}

function isEmptySettings(settings: Settings): boolean {
  return Object.keys(settings).length === 0;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([x], [y]) => x.localeCompare(y))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}

/** The skill ships inside the npm package next to dist/. */
function findSkillSource(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/cli.js → ../skills/pantry/SKILL.md ; src layout in dev → ../../skills/...
  for (const candidate of [
    join(here, "..", "skills", "pantry", "SKILL.md"),
    join(here, "..", "..", "skills", "pantry", "SKILL.md"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function rel(root: string, path: string): string {
  return path.startsWith(root) ? path.slice(root.length + 1) : path;
}
