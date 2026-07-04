import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildInventory } from "../src/inventory/build.js";

const FIXTURES = join(import.meta.dirname, "..", "fixtures");

function cleanPantryDirs() {
  for (const fixture of ["nextjs-app", "node-lib", "messy"]) {
    rmSync(join(FIXTURES, fixture, ".pantry"), { recursive: true, force: true });
  }
}

afterAll(cleanPantryDirs);

describe("nextjs-app fixture", () => {
  it("indexes components, hooks, utils, and schemas with usage counts", async () => {
    const { inventory } = await buildInventory(join(FIXTURES, "nextjs-app"));
    const byName = new Map(inventory.entries.map((e) => [`${e.file}#${e.name}`, e]));

    const formatDate = byName.get("src/lib/date.ts#formatDate");
    expect(formatDate?.kind).toBe("util");
    expect(formatDate?.usageCount).toBeGreaterThanOrEqual(3); // InvoiceRow, InvoiceTable, + test
    expect(formatDate?.testUsageCount).toBe(1);
    expect(formatDate?.doc).toContain("Format a date");

    const dialog = byName.get("src/components/ui/dialog.tsx#Dialog");
    expect(dialog?.kind).toBe("component");
    expect(dialog?.usageCount).toBeGreaterThanOrEqual(1);
    expect(dialog?.exportedFrom).toBe("src/components/ui/index.ts");

    expect(byName.get("src/hooks/useDebounce.ts#useDebounce")?.kind).toBe("hook");
    expect(byName.get("src/schemas/user.ts#signupSchema")?.kind).toBe("schema");

    // Button imported both directly and via the barrel
    const button = byName.get("src/components/ui/button.tsx#Button");
    expect(button?.usageCount).toBeGreaterThanOrEqual(3);

    // shadcn-style components/ui dir counts as ui-kit coverage
    const shadcn = inventory.deps.find((d) => d.family === "ui-kit");
    expect(shadcn?.name).toBe("components/ui (shadcn-style)");
    expect(shadcn?.usageCount).toBeGreaterThanOrEqual(2);

    // deps mapped to families with usage
    const dayjs = inventory.deps.find((d) => d.name === "dayjs");
    expect(dayjs?.family).toBe("dates");
    expect(dayjs?.usageCount).toBeGreaterThanOrEqual(1);
    expect(inventory.deps.find((d) => d.name === "react-hook-form")?.family).toBe("forms");
    expect(inventory.deps.find((d) => d.name === "lucide-react")?.family).toBe("icons");
    expect(inventory.deps.find((d) => d.name === "next")?.family).toBeNull();

    // test files are scanned for usage but their exports are not inventory
    expect(inventory.entries.some((e) => e.file.endsWith(".test.ts"))).toBe(false);
    expect(inventory.meta.parseErrorCount).toBe(0);
  });
});

describe("node-lib fixture", () => {
  it("resolves barrels and counts usage through them", async () => {
    const { inventory } = await buildInventory(join(FIXTURES, "node-lib"));
    const byName = new Map(inventory.entries.map((e) => [`${e.file}#${e.name}`, e]));

    const sum = byName.get("src/math.ts#sum");
    expect(sum?.exportedFrom).toBe("src/index.ts");
    expect(sum?.usageCount).toBe(1); // report.ts, routed through the barrel

    const mean = byName.get("src/math.ts#mean");
    expect(mean?.usageCount).toBe(2); // report.ts via barrel + math.test.ts direct
    expect(mean?.testUsageCount).toBe(1);

    expect(inventory.deps.find((d) => d.name === "lodash-es")?.family).toBe("utility-belt");
  });
});

describe("messy fixture", () => {
  it("surfaces the three formatDate duplicates and the dup date deps", async () => {
    const { inventory } = await buildInventory(join(FIXTURES, "messy"));
    const formatDates = inventory.entries.filter((e) => e.name === "formatDate");
    expect(formatDates).toHaveLength(3);
    expect(new Set(formatDates.map((e) => e.file)).size).toBe(3);

    const dateDeps = inventory.deps.filter((d) => d.family === "dates");
    expect(dateDeps.map((d) => d.name).sort()).toEqual(["dayjs", "moment"]);
    expect(inventory.deps.find((d) => d.name === "uuid")?.family).toBe("uuid");
  });
});

describe("incremental cache", () => {
  it("second build parses zero files", async () => {
    const root = join(FIXTURES, "node-lib");
    rmSync(join(root, ".pantry"), { recursive: true, force: true });
    const first = await buildInventory(root);
    expect(first.parsedCount).toBeGreaterThan(0);
    const second = await buildInventory(root);
    expect(second.parsedCount).toBe(0);
    expect(second.inventory.entries).toEqual(first.inventory.entries);
  });
});
