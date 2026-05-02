import { defineRunner, direct } from "./helpers.ts";

const markdownlintRunner = defineRunner({
  id: "markdownlint",
  launcher: direct("markdownlint"),
  args: ["--fix"],
});

export default markdownlintRunner;
