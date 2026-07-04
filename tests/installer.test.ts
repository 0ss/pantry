import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installClaudeCode, uninstallClaudeCode } from "../src/adapters/claude-code.js";
import { buildInventory } from "../src/inventory/build.js";
import { saveInventory } from "../src/paths.js";

const REPO = join(import.meta.dirname, "..");
let root: string;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "pantry-install-"));
  cpSync(join(REPO, "fixtures", "node-lib"), root, { recursive: true });
  rmSync(join(root, ".pantry"), { recursive: true, force: true });
  const { inventory } = await buildInventory(root);
  saveInventory(root, inventory);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const OPTS = { hookPrefix: "pantry" };

describe("pantry install claude-code", () => {
  it("wires hooks and places the skill", () => {
    installClaudeCode(root, OPTS);
    const settings = JSON.parse(readFileSync(join(root, ".claude", "settings.json"), "utf8"));
    expect(settings.hooks.PreToolUse[0].matcher).toBe("Bash");
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe("pantry hook pretooluse");
    expect(settings.hooks.SessionStart[0].hooks[0].command).toBe("pantry hook sessionstart");
    expect(existsSync(join(root, ".claude", "skills", "pantry", "SKILL.md"))).toBe(true);
  });

  it("is idempotent — second run changes nothing", () => {
    installClaudeCode(root, OPTS);
    const first = readFileSync(join(root, ".claude", "settings.json"), "utf8");
    installClaudeCode(root, OPTS);
    const second = readFileSync(join(root, ".claude", "settings.json"), "utf8");
    expect(second).toBe(first);
    const settings = JSON.parse(second);
    expect(settings.hooks.PreToolUse).toHaveLength(1);
  });

  it("merges with existing settings instead of clobbering", () => {
    mkdirSync(join(root, ".claude"), { recursive: true });
    const existing = {
      env: { FOO: "bar" },
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "my-own-guard.sh" }] }],
      },
    };
    writeFileSync(join(root, ".claude", "settings.json"), `${JSON.stringify(existing, null, 2)}\n`);

    installClaudeCode(root, OPTS);
    const settings = JSON.parse(readFileSync(join(root, ".claude", "settings.json"), "utf8"));
    expect(settings.env.FOO).toBe("bar");
    expect(settings.hooks.PreToolUse).toHaveLength(2);
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe("my-own-guard.sh");
  });

  it("refuses to touch a settings.json it can't parse", () => {
    mkdirSync(join(root, ".claude"), { recursive: true });
    writeFileSync(join(root, ".claude", "settings.json"), "{broken");
    const report = installClaudeCode(root, OPTS);
    expect(report.lines.join("\n")).toContain("not valid JSON");
    expect(readFileSync(join(root, ".claude", "settings.json"), "utf8")).toBe("{broken");
  });
});

describe("pantry uninstall claude-code", () => {
  it("byte-identical restore of a pre-existing settings.json", () => {
    mkdirSync(join(root, ".claude"), { recursive: true });
    const original = `${JSON.stringify({ env: { KEEP: "me" }, hooks: { Stop: [{ hooks: [{ type: "command", command: "notify.sh" }] }] } }, null, 2)}\n`;
    writeFileSync(join(root, ".claude", "settings.json"), original);

    installClaudeCode(root, OPTS);
    uninstallClaudeCode(root);

    expect(readFileSync(join(root, ".claude", "settings.json"), "utf8")).toBe(original);
    expect(existsSync(join(root, ".claude", "skills", "pantry", "SKILL.md"))).toBe(false);
  });

  it("removes settings.json entirely when install created it", () => {
    installClaudeCode(root, OPTS);
    uninstallClaudeCode(root);
    expect(existsSync(join(root, ".claude", "settings.json"))).toBe(false);
  });

  it("keeps user edits made after install, only strips pantry hooks", () => {
    installClaudeCode(root, OPTS);
    // user adds their own setting after installing pantry
    const path = join(root, ".claude", "settings.json");
    const settings = JSON.parse(readFileSync(path, "utf8"));
    settings.env = { ADDED_LATER: "yes" };
    writeFileSync(path, JSON.stringify(settings, null, 2));

    uninstallClaudeCode(root);
    const after = JSON.parse(readFileSync(path, "utf8"));
    expect(after.env.ADDED_LATER).toBe("yes");
    expect(JSON.stringify(after)).not.toContain("hook pretooluse");
  });

  it("survives a user hook that mentions pantry", () => {
    mkdirSync(join(root, ".claude"), { recursive: true });
    const original = {
      hooks: {
        PreToolUse: [
          { matcher: "Bash", hooks: [{ type: "command", command: "echo check-the-pantry-log" }] },
        ],
      },
    };
    writeFileSync(join(root, ".claude", "settings.json"), JSON.stringify(original, null, 2));
    installClaudeCode(root, OPTS);
    uninstallClaudeCode(root);
    const after = JSON.parse(readFileSync(join(root, ".claude", "settings.json"), "utf8"));
    expect(after.hooks.PreToolUse[0].hooks[0].command).toBe("echo check-the-pantry-log");
  });

  it("uninstall twice is safe", () => {
    installClaudeCode(root, OPTS);
    uninstallClaudeCode(root);
    const report = uninstallClaudeCode(root);
    expect(report.lines.some((l) => l.includes("not present"))).toBe(true);
  });
});
