# session-style.ts: "No API provider registered" Error Analysis

## Problem
The `selectEmojiWithAI()` function in `session-lifecycle/session-style.ts:253` fails with:
```
Error: No API provider registered for api: undefined
```

## Root Cause
The `complete()` function from `@mariozechner/pi-ai` is being called incorrectly:

**Current (broken) code:**
```typescript
const res = await complete({ 
  messages: [{ role: "system", content: AI_SELECT_PROMPT }, userMsg], 
  maxTokens: 10, 
  temperature: 0.7 
});
```

**Required signature:**
```typescript
const res = await complete(
  model,                           // ← Missing: LLM model specification
  { messages, systemPrompt, ... }, // ← Request options
  { apiKey, headers, signal, ... } // ← Missing: API credentials
);
```

## What's Missing

1. **Model Parameter (First Arg)**
   - Must pass `ctx.model` from ExtensionContext
   - Tells the API which model to use (Claude, GPT, etc.)

2. **API Credentials (Third Arg)**
   - Requires `apiKey` and/or `headers`
   - Should be obtained from `ctx.auth` or similar
   - Also accepts optional `signal` for AbortController

## Solution

Update `selectEmojiWithAI()` to pass all required parameters:

```typescript
async function selectEmojiWithAI(
  ctx: ExtensionContext, 
  config: SessionEmojiConfig, 
  api: any  // Need access to API/auth context
): Promise<string> {
  const recent = [...getRecentEmojis(ctx)].slice(0, 10);
  const messages = (ctx as any).messages?.slice(-config.contextMessages) ?? [];
  const userContent = messages.map((m: any) => 
    `${m.role}: ${typeof m.content === "string" ? m.content.slice(0, 200) : ""}`
  ).join("\n");
  
  const userMsg: UserMessage = { 
    role: "user", 
    content: `Context:\n${userContent || "(new conversation)"}\n\nRecently used: ${recent.join(" ") || "none"}` 
  };
  
  const res = await complete(
    ctx.model,  // ← Add: ExtensionContext.model
    { 
      messages: [{ role: "system", content: AI_SELECT_PROMPT }, userMsg], 
      maxTokens: 10, 
      temperature: 0.7 
    },
    {
      // ← Add: Authentication/headers
      apiKey: api?.apiKey,
      headers: api?.headers,
      // signal: abortController?.signal  // optional
    }
  );
  
  const emoji = (res?.content?.[0]?.text ?? "").trim();
  return emoji.length > 0 ? emoji[0] : getEmojiList(config)[0];
}
```

## References

See examples in pi-coding-agent:
- `node_modules/@mariozechner/pi-coding-agent/examples/extensions/qna.ts` — proper `complete()` usage
- `node_modules/@mariozechner/pi-coding-agent/examples/extensions/handoff.ts` — with auth headers
- `session-lifecycle/session-recap/index.ts` — alternative: use `completeSimple()` instead

## Next Steps

1. Check how to access API credentials from ExtensionContext
2. Update `selectEmojiWithAI()` signature to accept required parameters
3. Pass `ctx.model` and authentication details to `complete()`
4. Test emoji assignment with "ai" mode enabled
