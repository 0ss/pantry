import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { estimateTokens, summarize } from "../src/inventory/summarize.js";
import type { Inventory } from "../src/types.js";

const tmp = mkdtempSync(join(tmpdir(), "pantry-sum-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function makeInventory(entryCount: number): Inventory {
  return {
    entries: Array.from({ length: entryCount }, (_, i) => ({
      name: `helperFunctionNumber${i}`,
      kind: "util" as const,
      file: `src/utils/module-${i}/helpers.ts`,
      line: 1,
      signature: "(input, options)",
      doc: "Does a thing with the input and options.",
      usageCount: entryCount - i,
      testUsageCount: 0,
      topImporters: [],
    })),
    deps: [
      { name: "dayjs", version: "^1.0.0", family: "dates", usageCount: 23, dev: false },
      { name: "zod", version: "^3.0.0", family: "validation", usageCount: 12, dev: false },
    ],
    meta: {
      scannedAt: "",
      fileCount: 100,
      hashOfInputs: "x",
      parseErrorCount: 0,
      unresolvedImportCount: 0,
    },
  };
}

describe("summarize", () => {
  it("stays within the 600-token budget even with a huge inventory", () => {
    const text = summarize(makeInventory(500), tmp);
    expect(estimateTokens(text)).toBeLessThanOrEqual(600);
    expect(text).toContain("dates: dayjs (23 files)");
  });

  it("keeps highest-usage entries when trimming", () => {
    const text = summarize(makeInventory(500), tmp);
    expect(text).toContain("helperFunctionNumber0");
    expect(text).not.toContain("helperFunctionNumber499");
  });

  it("says the pantry is empty when it is", () => {
    const inventory = makeInventory(0);
    inventory.deps = [];
    const text = summarize(inventory, tmp);
    expect(text).toContain("Pantry is empty");
  });

  it("warns against installing exclusive-family alternatives", () => {
    const text = summarize(makeInventory(3), tmp);
    expect(text).toMatch(/dates: dayjs.*do not install/);
  });
});
