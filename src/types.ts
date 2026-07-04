export type ExportKind = "component" | "hook" | "util" | "schema" | "type" | "constant";

export interface InventoryEntry {
  name: string;
  kind: ExportKind;
  file: string;
  line: number;
  signature: string;
  /** First JSDoc line, if any. */
  doc: string;
  usageCount: number;
  /** How many of those usages are test files. */
  testUsageCount: number;
  /** Up to three importer files, non-test first. */
  topImporters: string[];
  /** Barrel file this export is re-exported from, if any. */
  exportedFrom?: string;
}

export interface DepEntry {
  name: string;
  version: string;
  family: string | null;
  usageCount: number;
  dev: boolean;
}

export interface InventoryMeta {
  scannedAt: string;
  fileCount: number;
  hashOfInputs: string;
  parseErrorCount: number;
  unresolvedImportCount: number;
}

export interface Inventory {
  entries: InventoryEntry[];
  deps: DepEntry[];
  meta: InventoryMeta;
}

export interface PantryConfig {
  include: string[];
  exclude: string[];
  tokenBudget: number;
  blockMode: "block" | "warn";
  extraCapabilities: CapabilityFamily[];
}

export interface CapabilityFamily {
  id: string;
  label: string;
  synonyms: string[];
  /** Package names; a trailing `*` is a prefix wildcard (e.g. `@mui/*`). */
  packages: string[];
  native: { name: string; note: string } | null;
  /** true = two members coexisting is near-certainly waste → hook blocks. */
  exclusive: boolean;
}

export interface AllowEntry {
  pkg: string;
  reason: string;
  date: string;
}

export interface LedgerEvent {
  ts: string;
  event: "block" | "warn" | "check" | "sync" | "init";
  detail: Record<string, unknown>;
}
