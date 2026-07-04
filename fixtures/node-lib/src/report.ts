import { mean, sum } from "./index";
import { capitalize } from "./strings";

export function describeSeries(label: string, values: number[]): string {
  return `${capitalize(label)}: total ${sum(values)}, avg ${mean(values).toFixed(2)}`;
}
