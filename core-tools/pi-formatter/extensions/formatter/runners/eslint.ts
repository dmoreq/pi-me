import { ESLINT_CONFIG_PATTERNS } from "./config-patterns.ts";
import { defineRunner, direct } from "./helpers.ts";

const eslintRunner = defineRunner({
  id: "eslint",
  launcher: direct("eslint"),
  when: (ctx) => ctx.hasConfig(ESLINT_CONFIG_PATTERNS),
  args: ["--fix"],
});

export default eslintRunner;
