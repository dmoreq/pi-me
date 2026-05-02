import { BIOME_CONFIG_PATTERNS } from "./config-patterns.ts";
import { defineRunner, direct } from "./helpers.ts";

const biomeRunner = defineRunner({
  id: "biome",
  launcher: direct("biome"),
  when: (ctx) => ctx.hasConfig(BIOME_CONFIG_PATTERNS),
  args: ["check", "--write"],
});

export default biomeRunner;
