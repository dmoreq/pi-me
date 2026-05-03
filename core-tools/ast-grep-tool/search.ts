/**
 * ast_grep_search — Registered pi tool for AST-aware code search.
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { astGrepSearch, isAstGrepAvailable } from "./client.ts";
import { LANGUAGES } from "./shared.ts";

export function createAstGrepSearchTool() {
	return {
		name: "ast_grep_search" as const,
		label: "AST Grep Search",
		description:
			"Search code using AST-aware pattern matching via ast-grep. " +
			"Use THIS instead of grep/text search when you need to match code STRUCTURE " +
			"(function definitions, method calls, imports, class declarations).\n\n" +
			"Pattern examples:\n" +
			'  - function $NAME($$$ARGS) { $$$BODY }  → any function\n' +
			"  - fetchMetrics($$$ARGS)               → any call to fetchMetrics\n" +
			'  - import { $NAMES } from "$PATH"      → any import\n' +
			"  - console.log($MSG)                    → console.log calls\n\n" +
			"Use 'paths' to scope to specific files/folders for faster results.",
		parameters: Type.Object({
			pattern: Type.String({
				description: "AST pattern with metavariables ($NAME, $$$ARGS)",
			}),
			lang: Type.String({
				enum: [...LANGUAGES] as string[],
				description: "Target programming language",
			}),
			paths: Type.Optional(
				Type.Array(Type.String(), {
					description: "Files/directories to search (defaults to cwd)",
				}),
			),
		}),
		async execute(
			_toolCallId: string,
			params: Record<string, unknown>,
			_signal: AbortSignal,
			_onUpdate: unknown,
			_ctx: ExtensionContext,
		) {
			if (!isAstGrepAvailable()) {
				return {
					content: [
						{
							type: "text" as const,
							text: "ast-grep CLI not found. Install: npm i -g @ast-grep/cli",
						},
					],
					isError: true,
					details: {},
				};
			}

			const { pattern, paths } = params as {
				pattern: string;
				lang: string;
				paths?: string[];
			};
			const lang = String(params.lang ?? "").replace(/^"|"$/g, "");

			const searchPaths = paths?.length ? paths : [process.cwd()];
			const result = astGrepSearch(pattern, lang, searchPaths);

			if (result.error) {
				return {
					content: [{ type: "text" as const, text: `Error: ${result.error}` }],
					isError: true,
					details: {},
				};
			}

			if (result.matches.length === 0) {
				return {
					content: [{ type: "text" as const, text: "No matches found." }],
					details: { matchCount: 0 },
				};
			}

			const lines = result.matches.map(
				(m) => `${m.file}:${m.line}:${m.column}  ${m.text.trim()}`,
			);
			return {
				content: [
					{
						type: "text" as const,
						text: `Found ${result.matches.length} match(es):\n\n${lines.join("\n")}`,
					},
				],
				details: { matchCount: result.matches.length },
			};
		},
	};
}
