// in-process command tests. the binary integration tests already prove the
// wiring; these run the same code paths inside vitest so coverage numbers
// tell the truth and failures point at lines instead of exit codes.
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { parseArgs } from "../src/cli.js";
import { allow } from "../src/commands/allow.js";
import { check } from "../src/commands/check.js";
import { doctor } from "../src/commands/doctor.js";
import { init } from "../src/commands/init.js";
import { install } from "../src/commands/install.js";
import { stats } from "../src/commands/stats.js";
import { sync } from "../src/commands/sync.js";
import { uninstall } from "../src/commands/uninstall.js";
import { recordEvent } from "../src/ledger.js";

const REPO = join(import.meta.dirname, "..");
let app: string;
let logged: string[] = [];
let log: ReturnType<typeof vi.spyOn>;
let err: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  app = mkdtempSync(join(tmpdir(), "pantry-cmds-"));
  cpSync(join(REPO, "fixtures", "nextjs-app"), app, { recursive: true });
  rmSync(join(app, ".pantry"), { recursive: true, force: true });
});

afterAll(() => rmSync(app, { recursive: true, force: true }));

function captureOutput() {
  logged = [];
  log = vi.spyOn(console, "log").mockImplementation((...a) => {
    logged.push(a.join(" "));
  });
  err = vi.spyOn(console, "error").mockImplementation((...a) => {
    logged.push(a.join(" "));
  });
}

afterEach(() => {
  log?.mockRestore();
  err?.mockRestore();
});

describe("parseArgs", () => {
  it("splits command, positionals, and flags", () => {
    expect(parseArgs(["check", "date", "formatting", "--json", "--top", "3"])).toEqual({
      command: "check",
      positional: ["date", "formatting"],
      flags: { json: true, top: "3" },
    });
  });
  it("boolean flags don't eat the next positional", () => {
    const parsed = parseArgs(["allow", "moment", "--reason", "legacy stuff"]);
    expect(parsed.flags.reason).toBe("legacy stuff");
    expect(parsed.positional).toEqual(["moment"]);
  });
});

describe("init + sync + check in-process", () => {
  it("init prints the summary and stocks the pantry", async () => {
    captureOutput();
    expect(await init(app)).toBe(0);
    const out = logged.join("\n");
    expect(out).toContain("Pantry stocked");
    expect(out).toContain("capability families covered");
  });

  it("sync reports reparse counts", async () => {
    captureOutput();
    expect(await sync(app)).toBe(0);
    expect(logged.join("\n")).toContain("0 re-parsed");
  });

  it("check finds the goods", async () => {
    captureOutput();
    expect(await check(app, "date formatting", { plain: true })).toBe(0);
    const out = logged.join("\n");
    expect(out).toContain("formatDate");
    expect(out).toContain("Recommendation:");
  });

  it("check --json is machine-clean", async () => {
    captureOutput();
    await check(app, "toast", { json: true });
    const parsed = JSON.parse(logged.join("\n"));
    expect(parsed.code[0].name).toBe("useToast");
  });

  it("check without a need errors helpfully via cli contract", async () => {
    captureOutput();
    // empty pantry answer, not a crash
    expect(await check(app, "quantum blockchain synergy", { plain: true })).toBe(0);
    expect(logged.join("\n")).toContain("Pantry is empty for this");
  });

  it("check auto-inits a fresh repo", async () => {
    const fresh = mkdtempSync(join(tmpdir(), "pantry-fresh-cmd-"));
    cpSync(join(REPO, "fixtures", "node-lib"), fresh, { recursive: true });
    rmSync(join(fresh, ".pantry"), { recursive: true, force: true });
    captureOutput();
    expect(await check(fresh, "clamp a number", { plain: true })).toBe(0);
    expect(logged.join("\n")).toContain("clamp");
    rmSync(fresh, { recursive: true, force: true });
  });
});

describe("stats + doctor in-process", () => {
  it("stats renders the scoreboard", async () => {
    recordEvent(app, "block", { pkg: "moment" });
    recordEvent(app, "check", { need: "x", empty: false, topHit: "src/lib/date.ts" });
    captureOutput();
    expect(await stats(app)).toBe(0);
    const out = logged.join("\n");
    expect(out).toContain("installs blocked");
    expect(out).toContain("moment");
  });

  it("stats --json parses", async () => {
    captureOutput();
    await stats(app, { json: true });
    const parsed = JSON.parse(logged.join("\n"));
    expect(parsed.installsBlocked).toBeGreaterThanOrEqual(1);
  });

  it("doctor reports wiring status", async () => {
    captureOutput();
    expect(await doctor(app)).toBe(0);
    const out = logged.join("\n");
    expect(out).toContain("inventory");
    expect(out).toContain("pantry install claude-code");
  });

  it("doctor exits 1 with no inventory", async () => {
    const empty = mkdtempSync(join(tmpdir(), "pantry-doc-"));
    captureOutput();
    expect(await doctor(empty)).toBe(1);
    rmSync(empty, { recursive: true, force: true });
  });
});

describe("install/uninstall wrappers", () => {
  it("rejects unknown targets", async () => {
    captureOutput();
    expect(await install(app, "cursor")).toBe(1);
    expect(await uninstall(app, "")).toBe(1);
    expect(logged.join("\n")).toContain("Supported: pantry install claude-code");
  });

  it("full round trip through the command layer", async () => {
    captureOutput();
    expect(await install(app, "claude-code")).toBe(0);
    expect(logged.join("\n")).toContain("wired");
    captureOutput();
    expect(await uninstall(app, "claude-code")).toBe(0);
    expect(logged.join("\n")).toContain("removed");
  });
});

describe("allow updates in place", () => {
  it("second allow for the same pkg updates the reason", async () => {
    captureOutput();
    await allow(app, "moment", "first reason");
    await allow(app, "moment", "better reason");
    const { loadAllowList } = await import("../src/commands/allow.js");
    const list = loadAllowList(app);
    expect(list.filter((a) => a.pkg === "moment")).toHaveLength(1);
    expect(list[0]?.reason).toBe("better reason");
  });
});
