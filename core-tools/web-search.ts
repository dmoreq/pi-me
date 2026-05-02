/**
 * pi-me: web-search — Web search tool.
 * Backends: Exa (EXA_API_KEY), Tavily (TAVILY_API_KEY), Valiyu (VALIYU_API_KEY)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  published?: string;
}

export interface SearchBackend {
  name: string;
  search(query: string, numResults: number, apiKey: string): Promise<SearchResult[]>;
}

const exaBackend: SearchBackend = {
  name: "exa",
  async search(query, numResults, apiKey) {
    const resp = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "User-Agent": "pi-web-search/0.1",
      },
      body: JSON.stringify({
        query,
        numResults: Math.min(numResults, 20),
        useAutoprompt: true,
        contents: { text: { maxCharacters: 256 } },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      throw new Error(`Exa returned ${resp.status}: ${await resp.text().catch(() => "")}`);
    }
    const data = (await resp.json()) as {
      results?: Array<{ title: string; url: string; text: string; publishedDate?: string }>;
    };
    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.text,
      published: r.publishedDate,
    }));
  },
};

const tavilyBackend: SearchBackend = {
  name: "tavily",
  async search(query, numResults, apiKey) {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "pi-web-search/0.1",
      },
      body: JSON.stringify({
        query,
        api_key: apiKey,
        max_results: Math.min(numResults, 20),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      throw new Error(`Tavily returned ${resp.status}: ${await resp.text().catch(() => "")}`);
    }
    const data = (await resp.json()) as {
      results?: Array<{ title: string; url: string; content: string }>;
    };
    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    }));
  },
};

/**
 * Valiyu backend.
 * Replace endpoint/response shape once the API is confirmed.
 * See: core-tools/web-search.ts top comment for env var names.
 */
const valiyuBackend: SearchBackend = {
  name: "valiyu",
  async search(query, numResults, apiKey) {
    // POST to the Valiyu API endpoint. Adjust URL/headers/body to match the real API.
    const resp = await fetch("https://api.valiyu.com/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "pi-web-search/0.1",
      },
      body: JSON.stringify({
        query,
        max_results: Math.min(numResults, 20),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      throw new Error(`Valiyu returned ${resp.status}: ${await resp.text().catch(() => "")}`);
    }
    const data = (await resp.json()) as {
      results?: Array<{ title: string; url: string; snippet: string; published?: string }>;
    };
    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      published: r.published,
    }));
  },
};

export function detectBackend(): { backend: SearchBackend; apiKey: string } | null {
  if (process.env.EXA_API_KEY) return { backend: exaBackend, apiKey: process.env.EXA_API_KEY };
  if (process.env.TAVILY_API_KEY) return { backend: tavilyBackend, apiKey: process.env.TAVILY_API_KEY };
  if (process.env.VALIYU_API_KEY) return { backend: valiyuBackend, apiKey: process.env.VALIYU_API_KEY };
  return null;
}

const WebSearchParams = Type.Object({
  query: Type.String({ description: "Search query" }),
  numResults: Type.Optional(
    Type.Number({ default: 10, maximum: 20, description: "Number of results (1-20)" }),
  ),
});

export function registerWebSearch(pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web for current information. Returns titles, URLs, and snippets.",
    parameters: WebSearchParams,
    async execute(_toolCallId, params) {
      const detected = detectBackend();
      if (!detected) {
        return {
          content: [
            {
              type: "text",
              text: "No search backend configured. Set EXA_API_KEY, TAVILY_API_KEY, or VALIYU_API_KEY environment variable.",
            },
          ],
        };
      }
      const numResults = Math.min(params.numResults ?? 10, 20);
      const results = await detected.backend.search(params.query, numResults, detected.apiKey);
      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No results found for: ${params.query}`,
            },
          ],
          details: { backend: detected.backend.name },
        };
      }
      const text = results
        .map(
          (r, i) =>
            `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}${r.published ? ` (${r.published})` : ""}`,
        )
        .join("\n\n");
      return {
        content: [{ type: "text", text }],
        details: { backend: detected.backend.name, results },
      };
    },
  });
}

export default registerWebSearch;
