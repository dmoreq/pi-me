/**
 * WebFetcher — Fetch and extract web content
 */

import type { FetchOptions, FetchResult } from "./types.ts";

export class WebFetcher {
  private timeout: number;
  private maxChars: number;

  constructor(timeout: number = 15000, maxChars: number = 50000) {
    this.timeout = timeout;
    this.maxChars = maxChars;
  }

  /**
   * Fetch a URL and return cleaned content.
   */
  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const timeout = options.timeout ?? this.timeout;
    const maxChars = options.maxChars ?? this.maxChars;

    // Mock implementation
    return {
      url,
      status: 200,
      headers: { "content-type": "text/html" },
      body: this.generateMockContent(url),
      contentType: "text/html",
    };
  }

  /**
   * Fetch multiple URLs in parallel.
   */
  async fetchMany(urls: string[], options: FetchOptions = {}): Promise<FetchResult[]> {
    const promises = urls.map(url => this.fetch(url, options));
    return Promise.all(promises);
  }

  /**
   * Extract text from HTML content.
   */
  extractText(html: string): string {
    // Simple HTML stripping (real implementation would use proper parser)
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private generateMockContent(url: string): string {
    return `<html><body>
<h1>Content from ${url}</h1>
<p>This is mock content fetched from the URL.</p>
<p>In a real implementation, this would be actual web content.</p>
</body></html>`;
  }
}
