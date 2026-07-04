// the write-time dup detector + subagent context injection — the hooks that
// make pantry work *inside* the agent loop, not just at install time.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO = join(import.meta.dirname, "..");
const POST_HOOK = join(REPO, "dist", "hooks", "posttooluse.js");
const SUBAGENT_HOOK = join(REPO, "dist", "hooks", "subagentstart.js");
const CLI = join(REPO, "dist", "cli.js");

let app: string;

function runPost(payload: object) {
  return spawnSync("node", [POST_HOOK], {
    cwd: app,
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
}

beforeAll(() => {
  expect(existsSync(POST_HOOK), "run `npm run build` first").toBe(true);
  app = mkdtempSync(join(tmpdir(), "pantry-agentic-"));
  cpSync(join(REPO, "fixtures", "nextjs-app"), app, { recursive: true });
  rmSync(join(app, ".pantry"), { recursive: true, force: true });
  execFileSync("node", [CLI, "init", "--quiet"], { cwd: app });
});

afterAll(() => rmSync(app, { recursive: true, force: true }));

describe("posttooluse write-time dup detector", () => {
  it("flags a Write that re-defines an existing export", () => {
    const r = runPost({
      tool_name: "Write",
      tool_input: {
        file_path: join(app, "src", "features", "orders", "helpers.ts"),
        content: `export function formatDate(d: Date) { return d.toISOString(); }\n`,
      },
    });
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    const context = out.hookSpecificOutput.additionalContext;
    expect(out.hookSpecificOutput.hookEventName).toBe("PostToolUse");
    expect(context).toContain("formatDate already exists at src/lib/date.ts");
    expect(context).toContain("Import the existing one");
  });

  it("flags an Edit that adds a duplicate hook", () => {
    const r = runPost({
      tool_name: "Edit",
      tool_input: {
        file_path: join(app, "src", "features", "feed", "FeedList.tsx"),
        old_string: "x",
        new_string: `export function useDebounce(v: string) { return v; }`,
      },
    });
    const context = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    expect(context).toContain("useDebounce already exists at src/hooks/useDebounce.ts");
  });

  it("stays silent for new names", () => {
    const r = runPost({
      tool_name: "Write",
      tool_input: {
        file_path: join(app, "src", "lib", "geo.ts"),
        content: `export function haversineDistance(a: number, b: number) { return a + b; }\n`,
      },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("stays silent when editing the file that owns the export", () => {
    const r = runPost({
      tool_name: "Edit",
      tool_input: {
        file_path: join(app, "src", "lib", "date.ts"),
        old_string: "x",
        new_string: `export function formatDate(d: Date, f = "L") { return String(d) + f; }`,
      },
    });
    expect(r.stdout).toBe("");
  });

  it("ignores non-source files, test files, and other tools", () => {
    for (const payload of [
      {
        tool_name: "Write",
        tool_input: { file_path: join(app, "notes.md"), content: "export const x = 1" },
      },
      {
        tool_name: "Write",
        tool_input: {
          file_path: join(app, "src", "a.test.ts"),
          content: "export function formatDate() {}",
        },
      },
      { tool_name: "Bash", tool_input: { command: "echo export function formatDate" } },
    ]) {
      const r = runPost(payload);
      expect(r.status).toBe(0);
      expect(r.stdout).toBe("");
    }
  });

  it("fails open on garbage input", () => {
    const r = spawnSync("node", [POST_HOOK], { cwd: app, input: "not json{", encoding: "utf8" });
    expect(r.status).toBe(0);
  });
});

describe("subagentstart context injection", () => {
  it("hands subagents the pantry summary as additionalContext", () => {
    const r = spawnSync("node", [SUBAGENT_HOOK], { cwd: app, encoding: "utf8" });
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.hookSpecificOutput.hookEventName).toBe("SubagentStart");
    expect(out.hookSpecificOutput.additionalContext).toContain("dates: dayjs");
  });

  it("says nothing where there's no pantry", () => {
    const empty = mkdtempSync(join(tmpdir(), "pantry-nopantry-"));
    const r = spawnSync("node", [SUBAGENT_HOOK], { cwd: empty, encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("");
    rmSync(empty, { recursive: true, force: true });
  });
});
