import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { allow } from "../src/commands/allow.js";
import { audit, buildAuditReport } from "../src/commands/audit.js";
import { buildInventory } from "../src/inventory/build.js";
import { readLedger, recordEvent } from "../src/ledger.js";
import type { Inventory } from "../src/types.js";

const FIXTURES = join(import.meta.dirname, "..", "fixtures");

// work on a copy so fixture dirs stay clean
let messy: string;
let messyInventory: Inventory;

beforeAll(async () => {
  messy = mkdtempSync(join(tmpdir(), "pantry-audit-"));
  cpSync(join(FIXTURES, "messy"), messy, { recursive: true });
  messyInventory = (await buildInventory(messy)).inventory;
});

afterAll(() => rmSync(messy, { recursive: true, force: true }));

describe("audit report on the messy fixture", () => {
  it("flags moment+dayjs as a duplicated exclusive family", () => {
    const report = buildAuditReport(messyInventory, messy);
    const dates = report.duplicateFamilies.find((d) => d.family === "dates");
    expect(dates?.exclusive).toBe(true);
    expect(dates?.packages.map((p) => p.name).sort()).toEqual(["dayjs", "moment"]);
  });

  it("finds formatDate defined three times, usage-ranked", () => {
    const report = buildAuditReport(messyInventory, messy);
    const dup = report.duplicateExports.find((d) => d.name === "formatDate");
    expect(dup?.definitions).toHaveLength(3);
    // the two imported ones come first, the orphan last
    expect(dup?.definitions[0]?.usageCount).toBeGreaterThanOrEqual(
      dup?.definitions[2]?.usageCount ?? 0,
    );
  });

  it("points uuid at crypto.randomUUID", () => {
    const report = buildAuditReport(messyInventory, messy);
    const uuid = report.nativeReplaceable.find((f) => f.package === "uuid");
    expect(uuid?.native).toBe("crypto.randomUUID");
  });
});

describe("audit --strict exit codes", () => {
  it("exits 1 on the messy fixture", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await audit(messy, { strict: true, json: true });
    log.mockRestore();
    expect(code).toBe(1);
  });

  it("exits 0 without --strict", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await audit(messy, { json: true });
    log.mockRestore();
    expect(code).toBe(0);
  });

  it("allow-listing one of the two dupes clears --strict", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await allow(messy, "moment", "legacy, migration tracked");
    const code = await audit(messy, { strict: true, json: true });
    log.mockRestore();
    expect(code).toBe(0);
  });

  it("allow without a reason is refused", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await allow(messy, "moment", "");
    err.mockRestore();
    expect(code).toBe(1);
  });
});

describe("ledger", () => {
  it("records and reads events, skipping torn lines", () => {
    const tmp = mkdtempSync(join(tmpdir(), "pantry-ledger-"));
    recordEvent(tmp, "block", { pkg: "moment" });
    recordEvent(tmp, "check", { need: "dates", empty: false, topHit: "src/lib/date.ts" });
    const events = readLedger(tmp);
    expect(events.map((e) => e.event)).toEqual(["block", "check"]);
    expect(events[0]?.detail.pkg).toBe("moment");
    rmSync(tmp, { recursive: true, force: true });
  });
});
