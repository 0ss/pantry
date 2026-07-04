/** Unique id for client-side records. No library needed. */
export function newId(): string {
  return crypto.randomUUID();
}
