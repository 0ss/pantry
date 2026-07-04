import { camelCase } from "lodash-es";

/** kebab-case → camelCase. */
export function toCamel(text: string): string {
  return camelCase(text);
}

/** Capitalize the first letter. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const EMPTY = "";
