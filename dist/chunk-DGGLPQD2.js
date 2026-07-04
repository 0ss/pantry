#!/usr/bin/env node
import {
  ensurePantryDir
} from "./chunk-QZWZRDGW.js";

// src/adapters/claude-code.ts
import { execSync } from "child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync
} from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
var HOOK_MARKERS = {
  pretooluse: "hook pretooluse",
  sessionstart: "hook sessionstart"
};
var SHELL_SAFE = /^[A-Za-z0-9 _.\-:/\\~+@]+$/;
function hookCommandPrefix() {
  try {
    execSync(process.platform === "win32" ? "where pantry" : "command -v pantry", {
      stdio: "ignore"
    });
    return "pantry";
  } catch {
    const script = process.argv[1] ?? "";
    if (!SHELL_SAFE.test(script) || !SHELL_SAFE.test(process.execPath)) return "pantry";
    return `"${process.execPath}" "${script}"`;
  }
}
function installClaudeCode(root, opts = {}) {
  const hookPrefix = opts.hookPrefix ?? hookCommandPrefix();
  const report = { lines: [] };
  const claudeDir = join(root, ".claude");
  const settingsPath = join(claudeDir, "settings.json");
  const skillPath = join(claudeDir, "skills", "pantry", "SKILL.md");
  const backupsDir = join(ensurePantryDir(root), "backups");
  mkdirSync(backupsDir, { recursive: true });
  const settingsExistedBefore = existsSync(settingsPath);
  let settings = {};
  let backupPath = null;
  if (settingsExistedBefore) {
    const raw = readFileSync(settingsPath, "utf8");
    try {
      settings = JSON.parse(raw);
    } catch {
      report.lines.push(`\u2717 ${rel(root, settingsPath)} is not valid JSON \u2014 not touching it.`);
      report.lines.push("  Fix it (or delete it) and re-run pantry install claude-code.");
      return report;
    }
    backupPath = join(backupsDir, `settings.json.${timestamp()}.bak`);
    copyFileSync(settingsPath, backupPath);
    report.lines.push(`\u2022 backed up settings.json \u2192 ${rel(root, backupPath)}`);
  }
  const changed = addHooks(settings, hookPrefix);
  if (changed) {
    mkdirSync(claudeDir, { recursive: true });
    writeSettingsAtomic(settingsPath, settings);
    report.lines.push(
      `\u2713 ${rel(root, settingsPath)} \u2014 PreToolUse (install-bouncer) + SessionStart (context) wired`
    );
  } else {
    report.lines.push(`\u2022 ${rel(root, settingsPath)} \u2014 hooks already wired, unchanged`);
    if (backupPath) {
      unlinkSync(backupPath);
      backupPath = null;
      report.lines.pop();
      report.lines.pop();
      report.lines.push(`\u2022 ${rel(root, settingsPath)} \u2014 hooks already wired, unchanged`);
    }
  }
  const skillSource = findSkillSource();
  if (skillSource) {
    if (existsSync(skillPath) && readFileSync(skillPath, "utf8") === readFileSync(skillSource, "utf8")) {
      report.lines.push(`\u2022 ${rel(root, skillPath)} \u2014 already in place, unchanged`);
    } else {
      mkdirSync(dirname(skillPath), { recursive: true });
      copyFileSync(skillSource, skillPath);
      report.lines.push(`\u2713 ${rel(root, skillPath)} \u2014 pantry skill placed`);
    }
  } else {
    report.lines.push(
      "\u2717 could not locate the bundled SKILL.md \u2014 skill not installed (hooks still work)"
    );
  }
  const manifest = {
    settingsPath,
    backupPath,
    settingsExistedBefore,
    skillPath,
    installedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  writeFileSync(
    join(backupsDir, "install-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}
`
  );
  return report;
}
function uninstallClaudeCode(root) {
  const report = { lines: [] };
  const claudeDir = join(root, ".claude");
  const settingsPath = join(claudeDir, "settings.json");
  const skillPath = join(claudeDir, "skills", "pantry", "SKILL.md");
  const backupsDir = join(root, ".pantry", "backups");
  let manifest = null;
  try {
    manifest = JSON.parse(readFileSync(join(backupsDir, "install-manifest.json"), "utf8"));
  } catch {
  }
  if (existsSync(settingsPath)) {
    let settings = null;
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    } catch {
      report.lines.push(`\u2717 ${rel(root, settingsPath)} is not valid JSON \u2014 leaving it alone.`);
    }
    if (settings) {
      const stripped = removeHooks(settings);
      const backup = manifest?.backupPath;
      if (backup && existsSync(backup) && deepEqual(stripped, JSON.parse(readFileSync(backup, "utf8")))) {
        copyFileSync(backup, settingsPath);
        report.lines.push(
          `\u2713 ${rel(root, settingsPath)} \u2014 restored from ${rel(root, backup)} (byte-identical)`
        );
      } else if (manifest && !manifest.settingsExistedBefore && isEmptySettings(stripped)) {
        unlinkSync(settingsPath);
        report.lines.push(`\u2713 ${rel(root, settingsPath)} \u2014 removed (we created it)`);
      } else {
        writeSettingsAtomic(settingsPath, stripped);
        report.lines.push(
          `\u2713 ${rel(root, settingsPath)} \u2014 pantry hooks removed, your settings kept`
        );
      }
    }
  } else {
    report.lines.push(`\u2022 ${rel(root, settingsPath)} \u2014 not present`);
  }
  if (existsSync(skillPath)) {
    unlinkSync(skillPath);
    report.lines.push(`\u2713 ${rel(root, skillPath)} \u2014 removed`);
    for (const dir of [dirname(skillPath), dirname(dirname(skillPath))]) {
      try {
        rmdirSync(dir);
      } catch {
        break;
      }
    }
  } else {
    report.lines.push(`\u2022 ${rel(root, skillPath)} \u2014 not present`);
  }
  return report;
}
function addHooks(settings, prefix) {
  settings.hooks ??= {};
  let changed = false;
  const wanted = [
    {
      event: "PreToolUse",
      marker: HOOK_MARKERS.pretooluse,
      entry: {
        matcher: "Bash",
        hooks: [{ type: "command", command: `${prefix} ${HOOK_MARKERS.pretooluse}`, timeout: 10 }]
      }
    },
    {
      event: "SessionStart",
      marker: HOOK_MARKERS.sessionstart,
      entry: {
        hooks: [
          { type: "command", command: `${prefix} ${HOOK_MARKERS.sessionstart}`, timeout: 10 }
        ]
      }
    }
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
function removeHooks(settings) {
  const out = structuredClone(settings);
  if (!out.hooks) return out;
  for (const event of Object.keys(out.hooks)) {
    if (!Array.isArray(out.hooks[event])) continue;
    out.hooks[event] = out.hooks[event].filter((group) => {
      const commands = extractCommands(group);
      return !commands.some(
        (c) => c.endsWith(` ${HOOK_MARKERS.pretooluse}`) || c.endsWith(` ${HOOK_MARKERS.sessionstart}`)
      );
    });
    if (out.hooks[event].length === 0) delete out.hooks[event];
  }
  if (Object.keys(out.hooks).length === 0) delete out.hooks;
  return out;
}
function extractCommands(group) {
  if (!group || typeof group !== "object") return [];
  const hooks = group.hooks;
  if (!Array.isArray(hooks)) return [];
  return hooks.map((h) => typeof h?.command === "string" ? h.command : "").filter(Boolean);
}
function validateHooks(settings) {
  if (!settings.hooks) return;
  for (const [event, groups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(groups)) throw new Error(`hooks.${event} is not an array`);
    for (const group of groups) {
      const hooks = group?.hooks;
      if (!Array.isArray(hooks)) throw new Error(`hooks.${event} entry missing hooks array`);
      for (const h of hooks) {
        if (h?.type !== "command" || typeof h?.command !== "string" || !h.command) {
          throw new Error(`hooks.${event} has a malformed command hook`);
        }
      }
    }
  }
}
function writeSettingsAtomic(path, settings) {
  validateHooks(settings);
  const tmp = `${path}.pantry-tmp`;
  writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}
`);
  renameSync(tmp, path);
}
function isEmptySettings(settings) {
  return Object.keys(settings).length === 0;
}
function deepEqual(a, b) {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([x], [y]) => x.localeCompare(y)).map(([k, v]) => [k, sortKeys(v)])
    );
  }
  return value;
}
function findSkillSource() {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [
    join(here, "..", "skills", "pantry", "SKILL.md"),
    join(here, "..", "..", "skills", "pantry", "SKILL.md")
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
function timestamp() {
  return (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
}
function rel(root, path) {
  return path.startsWith(root) ? path.slice(root.length + 1) : path;
}

export {
  installClaudeCode,
  uninstallClaudeCode
};
