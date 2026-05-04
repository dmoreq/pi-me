import { defineRunner, pypi } from "./helpers.ts";

const ruffFormatRunner = defineRunner({
  id: "ruff-format",
  launcher: pypi("ruff"),
  args: ["format"],
});

export default ruffFormatRunner;
