/**
 * ast_grep_replace — Registered pi tool for AST-aware code replacement.
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { astGrepReplace, astGrepSearch, isAstGrepAvailable } from "./client.ts";
import { LANGUAGES } from "./shared.ts";

export function createAstGrepReplaceTool() {
	return {
		name: "ast_grep_replace" as const,
		label: "AST Grep Replace",
		description:
			"Replace code across files using AST-aware pattern matching via ast-grep. " +
			"ALWAYS dry-run first: run with apply=false to see what will change.\n\n" +
			"Pattern examples:\n" +
			"  fetchMetrics($$$ARGS) → fetchMetricsWithCache($$$ARGS)\n" +
			"  console.log($$$ARGS) → void($$$ARGS)\n\n" +
			"Metavariables in the rewrite pattern ($NAME, $$$ARGS) are substituted " +
			"with the captured values from the search pattern.",
		parameters: Type.Object({
			pattern: Type.String({
				description: "AST search pattern with metavariables",
			}),
			rewrite: Type.String({
				description: "Replacement pattern using same metavariables",
			}),
			lang: Type.String({
				enum: [...LANGUAGES] as string[],
				description: "Target programming language",
			}),
			paths: Type.Optional(
				Type.Array(Type.String(), {
					description: "Files/directories to operate on",
				}),
			),
			apply: Type.Optional(
				Type.Boolean({
					description:
						"When false (default), only show matches without modifying files. " +
						"Set to true to actually apply the replacement.",
					default: false,
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

			const { pattern, rewrite, paths, apply } = params as {
				pattern: string;
				rewrite: string;
				lang: string;
				paths?: string[];
				apply?: boolean;
			};
			const lang = String(params.lang ?? "").replace(/^"|"$/g, "");

			if (apply) {
				const searchPaths = paths?.length ? paths : [process.cwd()];
				const result = astGrepReplace(pattern, rewrite, lang, searchPaths);

				if (result.error) {
					return {
						content: [
							{ type: "text" as const, text: `Error: ${result.error}` },
						],
						isError: true,
						details: {},
					};
				}

				return {
					content: [
						{
							type: "text" as const,
							text:
								result.filesChanged > 0
									? `✅ Replaced in ${result.filesChanged} file(s).`
									: "No files changed.",
						},
					],
					details: { filesChanged: result.filesChanged },
				};
			}

			// Dry-run: show matches
			const searchPaths = paths?.length ? paths : [process.cwd()];
			const searchResult = astGrepSearch(pattern, lang, searchPaths);

			if (searchResult.error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${searchResult.error}` },
					],
					isError: true,
					details: {},
				};
			}

			if (searchResult.matches.length === 0) {
				return {
					content: [{ type: "text" as const, text: "No matches found for dry-run." }],
					details: { matchCount: 0 },
				};
			}

			const lines = searchResult.matches.map(
				(m) => `${m.file}:${m.line}:${m.column}  ${m.text.trim()}`,
			);
			return {
				content: [
					{
						type: "text" as const,
						text:
							`[DRY-RUN] ${searchResult.matches.length} match(es) would be affected. ` +
							`Pass apply=true to execute:\n\n${lines.join("\n")}`,
					},
				],
				details: { matchCount: searchResult.matches.length },
			};
		},
	};
}
