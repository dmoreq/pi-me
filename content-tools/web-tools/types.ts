/**
 * Web Tools types
 */

export interface SearchQuery {
  query: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  rank: number;
}

export interface FetchOptions {
  timeout?: number;
  headers?: Record<string, string>;
  proxy?: string;
  followRedirects?: boolean;
  maxChars?: number;
}

export interface FetchResult {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  contentType?: string;
}

export interface WebToolsConfig {
  enabled: boolean;
  searchEngine?: string; // "google", "bing", "duckduckgo"
  timeout?: number;
  maxResults?: number;
  userAgent?: string;
}
