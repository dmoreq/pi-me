import { defineRunner, pypi } from "./helpers.ts";

const ruffCheckRunner = defineRunner({
  id: "ruff-check",
  launcher: pypi("ruff"),
  args: ["check", "--fix"],
});

export default ruffCheckRunner;
