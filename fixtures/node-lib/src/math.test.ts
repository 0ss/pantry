import { clamp, mean } from "./math";

if (clamp(5, 0, 3) !== 3) throw new Error("clamp");
if (mean([1, 2, 3]) !== 2) throw new Error("mean");
