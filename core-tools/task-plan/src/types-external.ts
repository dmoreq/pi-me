/**
 * External type declarations — types from pi-coding-agent that we reference
 * but don't define ourselves. Kept separate from types.ts to avoid circular deps.
 */

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}
