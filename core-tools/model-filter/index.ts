/**
 * Model Filter — Hides outdated Anthropic models, keeping only the latest Haiku, Sonnet, and Opus.
 *
 * Pi ships with many legacy/dated Anthropic model variants (e.g., claude-3-5-haiku-20241022,
 * claude-3-opus-20240229, claude-sonnet-4-0, etc.). This extension replaces the full Anthropic
 * model list with just the latest versions, reducing noise in /model and --list-models.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const LATEST_ANTHROPIC_MODELS = [
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 200000,
    maxTokens: 64000,
    cost: { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 200000,
    maxTokens: 64000,
    cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  },
  {
    id: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 1000000,
    maxTokens: 128000,
    cost: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  },
];

export default async function (pi: ExtensionAPI) {
  // Replace all built-in Anthropic models with only the latest versions.
  // The registerProvider() API removes all existing models for the provider
  // when a `models` array is provided, then adds only these entries.
  pi.registerProvider("anthropic", {
    api: "anthropic-messages",
    baseUrl: "https://api.anthropic.com/v1",
    apiKey: "ANTHROPIC_API_KEY",
    models: LATEST_ANTHROPIC_MODELS,
  });
}
