#!/usr/bin/env node
import {
  loadAllowList
} from "../chunk-PVKDUMKN.js";
import {
  recordEvent
} from "../chunk-ERKV7XNB.js";
import {
  findRepoRoot,
  loadConfig,
  loadInventory,
  logError
} from "../chunk-QZWZRDGW.js";
import {
  familyForPackage,
  loadFamilies
} from "../chunk-7SK2TDUQ.js";
import "../chunk-FYS2JH42.js";

// src/hooks/pretooluse.ts
import { readFileSync, statSync } from "fs";

// src/hooks/install-cmd.ts
var INSTALL_RE = /(?:^|&&|;|\|)\s*(?:npx\s+)?(npm|pnpm|yarn|bun)\s+(install|i|add)\b([^&;|]*)/g;
function parseInstallCommand(command) {
  if (!command) return null;
  const packages = [];
  let sawInstall = false;
  for (const match of command.matchAll(INSTALL_RE)) {
    const [full, manager, verb, rest] = match;
    if (/^\s*npx\s/.test(full)) continue;
    if ((manager === "yarn" || manager === "bun") && verb !== "add") {
      sawInstall = true;
      continue;
    }
    sawInstall = true;
    for (const token of (rest ?? "").trim().split(/\s+/)) {
      if (!token || token.startsWith("-")) continue;
      if (token === "install" || token === "add") continue;
      const pkg = stripVersion(token);
      if (pkg) packages.push(pkg);
    }
  }
  if (!sawInstall) return null;
  return { packages };
}
var PKG_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i;
function stripVersion(token) {
  if (token.startsWith(".") || token.startsWith("/") || token.includes("://")) return null;
  let name;
  if (token.startsWith("@")) {
    const at = token.indexOf("@", 1);
    name = at === -1 ? token : token.slice(0, at);
  } else {
    const at = token.indexOf("@");
    name = at === -1 ? token : token.slice(0, at);
  }
  return PKG_NAME.test(name) ? name : null;
}

// src/hooks/pretooluse.ts
async function main() {
  let root = process.cwd();
  try {
    root = findRepoRoot(process.cwd());
    const input = readFileSync(0, "utf8").replace(/^\uFEFF/, "");
    const payload = JSON.parse(input);
    const command = payload?.tool_input?.command ?? "";
    if (!command) return;
    const parsed = parseInstallCommand(command);
    if (!parsed || parsed.packages.length === 0) return;
    if (process.env.PANTRY_ALLOW === "1") return;
    const config = loadConfig(root);
    const families = loadFamilies(root);
    const inventory = loadInventory(root);
    let deps = inventory?.deps;
    if (!deps) {
      const { scanDeps } = await import("../deps-XCC4XPOM.js");
      deps = scanDeps(root, families);
    }
    if (deps.length === 0) return;
    const allowed = new Set(loadAllowList(root).map((a) => a.pkg));
    const stale = inventory ? isPackageJsonNewer(root) : false;
    for (const pkg of parsed.packages) {
      const family = familyForPackage(pkg, families);
      if (!family) continue;
      if (allowed.has(pkg)) continue;
      if (deps.some((d) => d.name === pkg)) continue;
      const covering = deps.filter((d) => d.family === family.id && !d.dev && d.name !== pkg).sort((a, b) => b.usageCount - a.usageCount)[0];
      if (!covering) continue;
      const usedIn = covering.usageCount > 0 ? `used in ${covering.usageCount} file${covering.usageCount === 1 ? "" : "s"}` : "in package.json";
      const lines = [
        `\u{1F96B} We have a ${family.label} at home.`,
        "",
        `BLOCKED: ${pkg} \u2014 already covered by ${covering.name} (${usedIn}).`,
        `Use ${covering.name}, or: pantry allow ${pkg} --reason "..."  (or PANTRY_ALLOW=1 for this session)`
      ];
      if (stale) lines.push("(inventory may be stale \u2014 `pantry sync` recommended)");
      if (family.exclusive && config.blockMode !== "warn") {
        process.stderr.write(`${lines.join("\n")}
`);
        recordEvent(root, "block", { pkg, coveredBy: covering.name, family: family.id, command });
        process.exitCode = 2;
        return;
      }
      lines[2] = `HEADS-UP: ${pkg} \u2014 this repo already has ${covering.name} (${usedIn}, same family: ${family.label}).`;
      process.stderr.write(`${lines.filter((_, i) => i !== 3).join("\n")}
`);
      recordEvent(root, "warn", { pkg, coveredBy: covering.name, family: family.id, command });
    }
  } catch (err) {
    try {
      logError(root, "pretooluse-hook", err);
    } catch {
    }
  }
}
function isPackageJsonNewer(root) {
  try {
    return statSync(`${root}/package.json`).mtimeMs > statSync(`${root}/.pantry/inventory.json`).mtimeMs;
  } catch {
    return false;
  }
}
await main();
