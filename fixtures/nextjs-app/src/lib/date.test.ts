import { describe, expect, it } from "vitest";
import { formatDate } from "./date";

describe("formatDate", () => {
  it("formats a date", () => {
    expect(formatDate("2026-03-04")).toBe("Mar 4, 2026");
  });
});
