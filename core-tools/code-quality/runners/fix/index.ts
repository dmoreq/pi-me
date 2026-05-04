/**
 * Fix Runners Export
 *
 * All available auto-fix runners for linters.
 */

export { biomeFix } from "./biome.ts";
export { eslintFix } from "./eslint.ts";
export { ruffFix } from "./ruff.ts";
export type { FixRunner, FixResult } from "./types.ts";

import { biomeFix } from "./biome.ts";
import { eslintFix } from "./eslint.ts";
import { ruffFix } from "./ruff.ts";

export const FIX_RUNNERS: readonly [typeof biomeFix, typeof eslintFix, typeof ruffFix] = [
  biomeFix,
  eslintFix,
  ruffFix,
];
