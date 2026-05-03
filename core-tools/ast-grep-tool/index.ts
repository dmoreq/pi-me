/**
 * AST-grep Tools — Extension entry.
 *
 * Registers ast_grep_search and ast_grep_replace as pi tools.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createAstGrepSearchTool } from "./search.ts";
import { createAstGrepReplaceTool } from "./replace.ts";

export default function (pi: ExtensionAPI) {
	pi.registerTool(createAstGrepSearchTool() as any);
	pi.registerTool(createAstGrepReplaceTool() as any);
}
