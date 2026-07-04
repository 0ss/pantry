import pc from "picocolors";
import type { QueryResult } from "./score.js";

export interface RenderOptions {
  json?: boolean;
  plain?: boolean;
}

/**
 * The canonical 🥫 PANTRY CHECK block. This format is the product — stable,
 * ≤20 lines, monospace-aligned, readable by an agent mid-task.
 */
export function renderCheck(result: QueryResult, opts: RenderOptions = {}): string {
  if (opts.json) {
    return JSON.stringify(
      {
        need: result.need,
        empty: result.empty,
        installed: result.installed.map(({ dep, family }) => ({
          name: dep.name,
          family: family.id,
          usageCount: dep.usageCount,
        })),
        code: result.code.map(({ entry, score }) => ({
          name: entry.name,
          kind: entry.kind,
          file: entry.file,
          line: entry.line,
          signature: entry.signature,
          usageCount: entry.usageCount,
          testUsageCount: entry.testUsageCount,
          score: Math.round(score),
        })),
        usedIn: result.usedIn,
        recommendation: result.recommendation.join(" "),
      },
      null,
      2,
    );
  }

  const color = !opts.plain && process.stdout.isTTY;
  const bold = (s: string) => (color ? pc.bold(s) : s);
  const dim = (s: string) => (color ? pc.dim(s) : s);
  const green = (s: string) => (color ? pc.green(s) : s);

  const lines: string[] = [bold("🥫 PANTRY CHECK"), `Need: ${result.need}`];

  if (result.empty) {
    lines.push("", "Pantry is empty for this. Building new is justified.");
    return lines.join("\n");
  }

  if (result.installed.length > 0) {
    lines.push("", bold("Already installed:"));
    for (const { dep } of result.installed.slice(0, 3)) {
      const where = dep.version === "local" ? "in-repo" : "package.json";
      lines.push(`  ${green("✓")} ${dep.name} (${where}, ${usedIn(dep.usageCount, 0)})`);
    }
  }

  // 20-line contract, but the recommendation is the point of the whole
  // block — budget backwards from it instead of chopping the tail off
  const recLines = result.recommendation.length > 0 ? 3 : 0; // blank + header + text
  const usedInLines = result.usedIn.length > 0 ? 2 + Math.min(result.usedIn.length, 3) : 0;
  let codeBudget = 20 - lines.length - recLines - (result.code.length > 0 ? 2 : 0);
  let showUsedIn = true;
  if (codeBudget - usedInLines >= 3) {
    codeBudget -= usedInLines; // room for both
  } else {
    showUsedIn = false; // tight — code entries beat the importer list
  }

  if (result.code.length > 0) {
    const shown = result.code.slice(0, Math.max(1, codeBudget));
    lines.push("", bold("Existing code:"));
    const labels = shown.map(({ entry }) => `${entry.name}${entry.signature}`);
    const width = Math.max(...labels.map((l) => l.length));
    shown.forEach(({ entry }, i) => {
      const label = labels[i] as string;
      lines.push(`  ${green("✓")} ${label.padEnd(width)}  ${entry.file}${dim(`:${entry.line}`)}`);
    });
  }

  if (showUsedIn && result.usedIn.length > 0) {
    lines.push("", bold("Used in:"));
    for (const file of result.usedIn.slice(0, 3)) lines.push(`  - ${file}`);
  }

  if (result.recommendation.length > 0) {
    lines.push("", bold("Recommendation:"), `  ${result.recommendation.join(" ")}`);
  }

  return lines.join("\n");
}

function usedIn(total: number, tests: number): string {
  const files = `used in ${total} file${total === 1 ? "" : "s"}`;
  return tests > 0 ? `${files} (${tests} tests)` : files;
}

export function usageLabel(total: number, tests: number): string {
  return usedIn(total, tests);
}
