/**
 * web-tools — barrel export
 */

export { WebToolsExtension, default } from "./web-tools/index.ts";
export { WebSearcher } from "./web-tools/searcher.ts";
export { WebFetcher } from "./web-tools/fetcher.ts";
export type { SearchQuery, SearchResult, FetchOptions, FetchResult, WebToolsConfig } from "./web-tools/types.ts";
