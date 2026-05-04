import type { RunnerDefinition } from "../types.ts";
import biomeRunner from "./biome.ts";
import clangFormatRunner from "./clang-format.ts";
import cmakeFormatRunner from "./cmake-format.ts";
import eslintRunner from "./eslint.ts";
import markdownlintRunner from "./markdownlint.ts";
import prettierRunner from "./prettier.ts";
import ruffCheckRunner from "./ruff-check.ts";
import ruffFormatRunner from "./ruff-format.ts";
import shfmtRunner from "./shfmt.ts";

export const RUNNER_DEFINITIONS: RunnerDefinition[] = [
  clangFormatRunner,
  cmakeFormatRunner,
  markdownlintRunner,
  biomeRunner,
  eslintRunner,
  prettierRunner,
  shfmtRunner,
  ruffFormatRunner,
  ruffCheckRunner,
];

function buildRunnerRegistry(
  definitions: RunnerDefinition[],
): Map<string, RunnerDefinition> {
  const registry = new Map<string, RunnerDefinition>();

  for (const runner of definitions) {
    if (registry.has(runner.id)) {
      throw new Error(`Duplicate runner registration: ${runner.id}`);
    }

    registry.set(runner.id, runner);
  }

  return registry;
}

export const RUNNERS = buildRunnerRegistry(RUNNER_DEFINITIONS);
