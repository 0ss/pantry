// the real caller of `pantry check` is an LLM, and LLMs write sentences,
// not search queries. these are realistic agent phrasings; noise must not
// outrank the actual answer. this class of bug shipped once (conversational
// "use"/"react" matched hook names and file paths), never again.
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildInventory } from "../src/inventory/build.js";
import { query } from "../src/query/score.js";
import type { Inventory } from "../src/types.js";

const FIXTURE = join(import.meta.dirname, "..", "fixtures", "nextjs-app");
let inventory: Inventory;

beforeAll(async () => {
  inventory = (await buildInventory(FIXTURE)).inventory;
});

describe("agent-style conversational needs", () => {
  it("'moment.js — date library; does the repo already have a date lib?'", () => {
    const r = query(inventory, "moment.js — date library; does the repo already have a date lib?", FIXTURE);
    expect(r.installed.map((i) => i.dep.name)).toContain("dayjs");
    expect(r.code[0]?.entry.file).toBe("src/lib/date.ts");
  });

  it("'chakra ui — React component library; what UI system does the repo already use?'", () => {
    const r = query(inventory, "chakra ui — React component library; what UI system does the repo already use?", FIXTURE);
    // top hits must be actual UI components, not hooks that mention "use" or
    // files with "react" in the path
    const topKinds = r.code.slice(0, 3).map((c) => c.entry.kind);
    for (const kind of topKinds) expect(["component", "util"]).toContain(kind);
    expect(r.code.map((c) => c.entry.name)).not.toContain("useDebounce");
  });

  it("'we need to add a toast notification when the user saves'", () => {
    const r = query(inventory, "we need to add a toast notification when the user saves", FIXTURE);
    expect(r.code[0]?.entry.name).toMatch(/Toast|useToast/);
  });

  it("'should we install lodash for a debounce helper?'", () => {
    const r = query(inventory, "should we install lodash for a debounce helper?", FIXTURE);
    expect(r.code[0]?.entry.name).toBe("useDebounce");
  });

  it("'is there already a modal or dialog component in this project?'", () => {
    const r = query(inventory, "is there already a modal or dialog component in this project?", FIXTURE);
    expect(r.code[0]?.entry.name).toBe("Dialog");
  });

  it("pure filler still comes back empty instead of matching garbage", () => {
    const r = query(inventory, "do we already have something for this in the project?", FIXTURE);
    expect(r.empty).toBe(true);
  });
});
