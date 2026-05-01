/**
 * pi-me: web-search — Web search tool.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

export interface SearchResult { title: string; url: string; snippet: string; published?: string; }
export interface SearchBackend { name: string; search(query: string, numResults: number, apiKey: string): Promise<SearchResult[]>; }

const kagiBackend: SearchBackend = {
	name: "kagi", async search(_query, _numResults, _apiKey) { return []; },
};

const braveBackend: SearchBackend = {
	name: "brave",
	async search(query, numResults, apiKey) {
		const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${numResults}`;
		const resp = await fetch(url, {
			headers: { Accept: "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": apiKey, "User-Agent": "pi-web-search/0.1" },
			signal: AbortSignal.timeout(15000),
		});
		if (!resp.ok) throw new Error(`Brave Search returned ${resp.status}: ${await resp.text().catch(() => "")}`);
		const data = (await resp.json()) as { web?: { results?: Array<{ title: string; url: string; description: string; page_age?: string }> } };
		return (data.web?.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.description, published: r.page_age }));
	},
};

const serpapiBackend: SearchBackend = {
	name: "serpapi",
	async search(query, numResults, apiKey) {
		const url = `https://serpapi.com/search?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=${numResults}&engine=google`;
		const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
		if (!resp.ok) throw new Error(`SerpAPI returned ${resp.status}`);
		const data = (await resp.json()) as { organic_results?: Array<{ title: string; link: string; snippet: string; date?: string }> };
		return (data.organic_results ?? []).map((r) => ({ title: r.title, url: r.link, snippet: r.snippet, published: r.date }));
	},
};

function detectBackend(): { backend: SearchBackend; apiKey: string } | null {
	if (process.env.SERPAPI_KEY) return { backend: serpapiBackend, apiKey: process.env.SERPAPI_KEY };
	if (process.env.BRAVE_API_KEY) return { backend: braveBackend, apiKey: process.env.BRAVE_API_KEY };
	if (process.env.KAGI_API_KEY) return { backend: kagiBackend, apiKey: process.env.KAGI_API_KEY };
	return null;
}

const WebSearchParams = Type.Object({
	query: Type.String({ description: "Search query" }),
	numResults: Type.Optional(Type.Number({ default: 10, maximum: 20, description: "Number of results (1-20)" })),
});

export function registerWebSearch(pi: ExtensionAPI) {
	pi.registerTool({
		name: "web_search",
		label: "Web Search",
		description: "Search the web for current information. Returns titles, URLs, and snippets.",
		parameters: WebSearchParams,
		async execute(_toolCallId, params) {
			const detected = detectBackend();
			if (!detected) {
				return { content: [{ type: "text", text: "No search backend configured. Set SERPAPI_KEY, BRAVE_API_KEY, or KAGI_API_KEY environment variable." }] };
			}
			const numResults = Math.min(params.numResults ?? 10, 20);
			const results = await detected.backend.search(params.query, numResults, detected.apiKey);
			if (results.length === 0) {
				return { content: [{ type: "text", text: `No results found for: ${params.query}` }], details: { backend: detected.backend.name } };
			}
			const text = results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}${r.published ? ` (${r.published})` : ""}`).join("\n\n");
			return { content: [{ type: "text", text }], details: { backend: detected.backend.name, results } };
		},
	});
}

export default registerWebSearch;
