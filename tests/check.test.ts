import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildInventory } from "../src/inventory/build.js";
import { renderCheck } from "../src/query/render.js";
import { query } from "../src/query/score.js";
import type { Inventory } from "../src/types.js";

const FIXTURES = join(import.meta.dirname, "..", "fixtures");
const inventories: Record<string, Inventory> = {};

beforeAll(async () => {
  for (const fixture of ["nextjs-app", "node-lib", "messy"]) {
    inventories[fixture] = (await buildInventory(join(FIXTURES, fixture))).inventory;
  }
});

function checkOutput(fixture: string, need: string): string {
  const inventory = inventories[fixture] as Inventory;
  return renderCheck(query(inventory, need, join(FIXTURES, fixture)), { plain: true });
}

describe("pantry check snapshots (nextjs-app)", () => {
  it("date formatting", () => {
    const out = checkOutput("nextjs-app", "date formatting");
    expect(out).toContain("dayjs");
    expect(out).toContain("formatDate");
    expect(out).toContain("src/lib/date.ts");
    expect(out).toContain("Do not install another date library.");
    expect(out.split("\n").length).toBeLessThanOrEqual(20);
    expect(out).toMatchSnapshot();
  });

  it("relative time on comments", () => {
    const out = checkOutput("nextjs-app", "relative time on comments");
    expect(out).toContain("formatRelativeTime");
    expect(out).toMatchSnapshot();
  });

  it("a modal (synonym → Dialog)", () => {
    const out = checkOutput("nextjs-app", "a delete confirmation modal");
    expect(out.indexOf("Dialog")).toBeGreaterThan(-1);
    // Dialog must be the #1 code hit
    const firstCodeLine = out.split("Existing code:")[1]?.trim().split("\n")[0] ?? "";
    expect(firstCodeLine).toContain("Dialog");
    expect(out).toMatchSnapshot();
  });

  it("toast on save", () => {
    const out = checkOutput("nextjs-app", "show a toast when saving");
    expect(out).toContain("useToast");
    expect(out).toMatchSnapshot();
  });

  it("debounced search input", () => {
    const out = checkOutput("nextjs-app", "debounce a search input");
    expect(out).toContain("useDebounce");
    expect(out).toMatchSnapshot();
  });

  it("signup form validation", () => {
    const out = checkOutput("nextjs-app", "signup form validation");
    expect(out).toContain("signupSchema");
    expect(out).toContain("react-hook-form");
    expect(out).toMatchSnapshot();
  });

  it("class name joining", () => {
    const out = checkOutput("nextjs-app", "join class names conditionally");
    expect(out).toContain("cn(");
    expect(out).toMatchSnapshot();
  });

  it("empty pantry: websockets", () => {
    const out = checkOutput("nextjs-app", "websocket client with reconnect");
    expect(out).toBe(
      "🥫 PANTRY CHECK\nNeed: websocket client with reconnect\n\nPantry is empty for this. Building new is justified.",
    );
  });
});

describe("pantry check snapshots (node-lib)", () => {
  it("clamp a number", () => {
    const out = checkOutput("node-lib", "clamp a number to a range");
    expect(out).toContain("clamp");
    expect(out).toContain("src/math.ts");
    expect(out).toMatchSnapshot();
  });

  it("lodash-style helpers", () => {
    const out = checkOutput("node-lib", "lodash helpers");
    expect(out).toContain("lodash-es");
    expect(out).toMatchSnapshot();
  });

  it("empty pantry: colors", () => {
    const out = checkOutput("node-lib", "terminal color output");
    expect(out).toContain("Pantry is empty for this. Building new is justified.");
  });
});

describe("pantry check snapshots (messy)", () => {
  it("date formatting shows all three duplicates", () => {
    const out = checkOutput("messy", "format a date");
    expect(out).toContain("moment");
    expect(out).toContain("dayjs");
    const matches = out.match(/formatDate/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
    expect(out).toMatchSnapshot();
  });

  it("unique ids", () => {
    const out = checkOutput("messy", "generate a unique id");
    expect(out).toContain("uuid");
    expect(out).toMatchSnapshot();
  });
});

describe("check output contract", () => {
  it("--json emits stable structured data", () => {
    const inventory = inventories["nextjs-app"] as Inventory;
    const out = renderCheck(query(inventory, "date formatting", join(FIXTURES, "nextjs-app")), {
      json: true,
    });
    const parsed = JSON.parse(out);
    expect(parsed.need).toBe("date formatting");
    expect(parsed.empty).toBe(false);
    expect(parsed.installed[0].name).toBe("dayjs");
    expect(parsed.code[0].file).toBe("src/lib/date.ts");
    expect(typeof parsed.recommendation).toBe("string");
  });

  it("determinism: same input → identical output", () => {
    expect(checkOutput("nextjs-app", "date formatting")).toBe(
      checkOutput("nextjs-app", "date formatting"),
    );
  });

  it("every output stays within 20 lines", () => {
    for (const need of ["date formatting", "modal", "form", "toast", "chart", "icons"]) {
      expect(checkOutput("nextjs-app", need).split("\n").length).toBeLessThanOrEqual(20);
    }
  });
});
