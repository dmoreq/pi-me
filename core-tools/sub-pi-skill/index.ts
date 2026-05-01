import { loadConfigOrDefault } from "../../foundation/pi-config.js";
import { DEFAULT_OPTIONS, subPiSkill } from "./extension.js";
import { z } from "zod";

const ConfigSchema = z.object({
  toolName: z.string().optional(),
});

const config = loadConfigOrDefault({
  filename: "sub-pi-skill.jsonc",
  schema: ConfigSchema,
  defaults: DEFAULT_OPTIONS,
});

export default subPiSkill(config);
