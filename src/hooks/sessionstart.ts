// SessionStart hook: make sure the pantry is stocked, then hand the agent
// PANTRY.md as hidden context. On the very first stock of a repo we also
// show the user a one-liner so they can see the thing arm itself.
//
// Zero-config path: plugin installed, session opens in a JS/TS repo with no
// .pantry yet → we scan right here (the scanner does ~1k files in ~150ms)
// so the bouncer and the summary work from minute one.
//
// Anything goes wrong → say nothing, exit 0. Never wreck a session start.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findRepoRoot, loadInventory } from "../paths.js";

async function main(): Promise<void> {
  try {
    const root = findRepoRoot(process.cwd());
    const inventoryPath = join(root, ".pantry", "inventory.json");
    const summaryPath = join(root, ".pantry", "PANTRY.md");

    // only auto-init where it makes sense: an actual JS/TS project
    let firstStock = false;
    if (!existsSync(inventoryPath)) {
      if (!existsSync(join(root, "package.json"))) return;
      const { init } = await import("../commands/init.js");
      await init(root, { quiet: true });
      firstStock = true;
    } else if (isStale(root, inventoryPath)) {
      const { sync } = await import("../commands/sync.js");
      await sync(root, { quiet: true });
    }

    if (!existsSync(summaryPath)) return;
    const summary = readFileSync(summaryPath, "utf8");

    // tell the agent exactly how to run checks, wherever this plugin lives
    const cliPath = join(dirname(fileURLToPath(import.meta.url)), "..", "cli.js");
    const checkCmd = existsSync(cliPath) ? `node "${cliPath}"` : "pantry";

    let context =
      `${summary}\n\n` +
      `Pantry command for this session (also aliased as \`pantry\` if installed):\n  ${checkCmd} check "<need>"\n` +
      `Keep the need short (2-4 words, like a search query). Run it before creating components/hooks/utils/schemas or adding dependencies.\n`;
    context += statuslineNudge();

    if (firstStock) {
      // first time in this repo: make the arming visible to the human
      const inv = loadInventory(root);
      const message = inv
        ? `🥫 pantry stocked: ${inv.deps.length} deps mapped, ${inv.entries.length} exports indexed. duplicate installs get bounced from here on.`
        : "🥫 pantry stocked.";
      process.stdout.write(
        `${JSON.stringify({
          systemMessage: message,
          hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
        })}\n`,
      );
      return;
    }

    process.stdout.write(context);
  } catch {
    // no pantry here, nothing to say
  }
}

function isStale(root: string, inventoryPath: string): boolean {
  try {
    return statSync(join(root, "package.json")).mtimeMs > statSync(inventoryPath).mtimeMs;
  } catch {
    return false;
  }
}

// no automatic settings.json writes from a hook — we ask the agent to offer
// it through the permission system instead. only when no statusline exists,
// and only when our path is shell-safe enough to embed in a command.
function statuslineNudge(): string {
  try {
    const configDir = process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME || "", ".claude");
    const settingsPath = join(configDir, "settings.json");
    if (existsSync(settingsPath)) {
      const settings = JSON.parse(readFileSync(settingsPath, "utf8").replace(/^\uFEFF/, ""));
      if (settings.statusLine) return "";
    }
    const script = join(dirname(fileURLToPath(import.meta.url)), "statusline.js");
    if (!/^[A-Za-z0-9 _.\-:/\\~+@]+$/.test(script) || !existsSync(script)) return "";
    return (
      `\nSTATUSLINE (optional, mention at most once): the user has no statusline configured. ` +
      `If it fits the conversation, offer to add pantry's blocked-installs badge by setting ` +
      `"statusLine": { "type": "command", "command": "node \\"${script}\\"" } in ${settingsPath}. ` +
      `Only do it if they say yes.\n`
    );
  } catch {
    return "";
  }
}

await main();
