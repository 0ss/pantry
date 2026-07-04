/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Sum an array of numbers. */
export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/** Arithmetic mean; 0 for an empty array. */
export function mean(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}
