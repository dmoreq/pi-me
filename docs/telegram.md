# Pi × Telegram Integration

Connect Pi to Telegram so that:

- **Pi → Telegram** — Pi notifies you when it finishes working, or sends messages proactively during a session.
- **Telegram → Pi** — You send instructions to Pi from your phone and it acts on them.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Step 1 — Create a Telegram Bot](#step-1--create-a-telegram-bot)
- [Step 2 — Find Your Chat ID](#step-2--find-your-chat-id)
- [Step 3 — Secure Credentials with Pi Secrets](#step-3--secure-credentials-with-pi-secrets)
- [Step 4 — Notification Extension (Pi → Telegram)](#step-4--notification-extension-pi--telegram)
- [Step 5 — Send-on-Demand Tool (LLM → Telegram)](#step-5--send-on-demand-tool-llm--telegram)
- [Step 6 — Polling Extension (Telegram → Pi)](#step-6--polling-extension-telegram--pi)
- [Putting It All Together](#putting-it-all-together)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Pi installed and working (`pi --version`)
- Node.js ≥ 18 (used by Pi's extension runtime)
- A Telegram account

---

## Step 1 — Create a Telegram Bot

1. Open Telegram and search for **@BotFather**.
2. Send `/newbot` and follow the prompts to choose a name and username.
3. BotFather will reply with a **bot token** that looks like:

   ```
   7123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   Keep this safe — it's equivalent to a password.

---

## Step 2 — Find Your Chat ID

You need the numeric ID of the chat where Pi will send messages (your personal DM with the bot, a group, etc.).

1. Start a conversation with your new bot (send it `/start`).
2. Visit the following URL in your browser, replacing `<TOKEN>` with your bot token:

   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```

3. Look for `"chat":{"id":` in the JSON response. The number next to it is your **chat ID**.

   ```json
   {
     "message": {
       "chat": { "id": 123456789, ... }
     }
   }
   ```

   > **Groups:** Chat IDs for groups are negative numbers (e.g. `-1001234567890`). Add the bot to the group and send a message there before calling `getUpdates`.

---

## Step 3 — Secure Credentials with Pi Secrets

Never hard-code tokens in extension files. Use Pi's secret store instead.

Create or edit **`~/.pi/agent/secrets.yml`** (global secrets):

```yaml
# ~/.pi/agent/secrets.yml
- type: plain
  content: "7123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  mode: obfuscate
```

Then expose the token and chat ID as **environment variables** — either in your shell profile or in a project `.env` file sourced before launching Pi:

```bash
# ~/.zshrc / ~/.bashrc
export TELEGRAM_BOT_TOKEN="7123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export TELEGRAM_CHAT_ID="123456789"
```

Pi's secret system automatically obfuscates values that match `*TOKEN*` and `*KEY*` patterns before they reach the LLM, so `TELEGRAM_BOT_TOKEN` is covered out of the box.

---

## Step 4 — Notification Extension (Pi → Telegram)

This extension sends a Telegram message every time Pi finishes a turn and is waiting for your input — great for long-running tasks where you step away.

Create **`~/.pi/agent/extensions/telegram-notify.ts`**:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendMessage(text: string): Promise<void> {
  if (!TOKEN || !CHAT_ID) return;

  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "Markdown" }),
  });
}

export default function (pi: ExtensionAPI) {
  pi.on("agent_end", async () => {
    await sendMessage("🤖 *Pi is done* — ready for your next message.");
  });
}
```

**Test it:**

```bash
pi -e ~/.pi/agent/extensions/telegram-notify.ts
```

Give Pi a task, wait for it to finish, and check your Telegram. Once verified, the file is auto-discovered from `~/.pi/agent/extensions/` on every Pi session — no flag needed.

---

## Step 5 — Send-on-Demand Tool (LLM → Telegram)

Register a `telegram_send` tool so the LLM can proactively send you updates mid-session (e.g. "I found a bug — check Telegram").

Add this to your `telegram-notify.ts` (or create a separate file):

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendMessage(text: string): Promise<void> {
  if (!TOKEN || !CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "Markdown" }),
  });
}

export default function (pi: ExtensionAPI) {
  // Notify on turn end
  pi.on("agent_end", async () => {
    await sendMessage("🤖 *Pi is done* — ready for your next message.");
  });

  // Let the LLM send messages explicitly
  pi.registerTool({
    name: "telegram_send",
    label: "Send Telegram Message",
    description:
      "Send a message to the user's Telegram chat. Use this to report progress, findings, or ask a question when the user is away.",
    parameters: Type.Object({
      message: Type.String({
        description: "Markdown-formatted message to send to the user.",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      await sendMessage(params.message);
      return {
        content: [{ type: "text", text: "Message sent to Telegram." }],
        details: {},
      };
    },
  });
}
```

You can now prompt Pi with:

> "Analyse the test suite, fix any failures, and send me a Telegram summary when done."

Pi will call `telegram_send` with a markdown summary and you'll receive it on your phone.

---

## Step 6 — Polling Extension (Telegram → Pi)

This is the bidirectional half: Pi polls the Telegram Bot API for new messages and injects them into the session as if you typed them. This lets you steer Pi from your phone while it's running.

> **How it works:** Telegram's `getUpdates` API uses long-polling. The extension runs a background loop, fetches updates, and calls `pi.sendUserMessage()` to inject each new message into the active session.

Create **`~/.pi/agent/extensions/telegram-bridge.ts`**:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ── Telegram helpers ─────────────────────────────────────────────────────────

async function sendMessage(text: string): Promise<void> {
  if (!TOKEN || !CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "Markdown" }),
  });
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
  };
}

async function getUpdates(offset: number, timeoutSecs = 20): Promise<TelegramUpdate[]> {
  if (!TOKEN) return [];
  const url =
    `https://api.telegram.org/bot${TOKEN}/getUpdates` +
    `?offset=${offset}&timeout=${timeoutSecs}&allowed_updates=["message"]`;

  const res = await fetch(url, { signal: AbortSignal.timeout((timeoutSecs + 5) * 1000) });
  if (!res.ok) return [];
  const json = (await res.json()) as { ok: boolean; result: TelegramUpdate[] };
  return json.ok ? json.result : [];
}

// ── Extension ────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  if (!TOKEN || !CHAT_ID) {
    console.warn("[telegram-bridge] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping.");
    return;
  }

  let offset = 0;
  let running = false;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  async function poll(): Promise<void> {
    if (!running) return;
    try {
      const updates = await getUpdates(offset);
      for (const update of updates) {
        offset = update.update_id + 1;

        const msg = update.message;
        if (!msg || String(msg.chat.id) !== String(CHAT_ID)) continue;
        if (!msg.text) continue;

        // Ignore /start or bot commands
        if (msg.text.startsWith("/")) continue;

        // Inject the Telegram message into Pi as a user message
        await pi.sendUserMessage(`[Telegram] ${msg.text}`);
      }
    } catch {
      // Network errors are transient — keep polling
    }

    if (running) {
      pollTimer = setTimeout(poll, 1000);
    }
  }

  // Start polling when the session initialises
  pi.on("session_start", async (_event, ctx) => {
    running = true;
    poll();
    ctx.ui.notify("Telegram bridge active — send messages from your phone.", "info");
    await sendMessage("🟢 *Pi session started.* Send me a message to interact.");
  });

  // Stop polling on session end and send a farewell
  pi.on("session_end", async () => {
    running = false;
    if (pollTimer) clearTimeout(pollTimer);
    await sendMessage("🔴 *Pi session ended.*");
  });

  // Notify on every completed turn
  pi.on("agent_end", async () => {
    await sendMessage("🤖 *Pi is done* — waiting for input.");
  });

  // Let the LLM send proactive messages
  pi.registerTool({
    name: "telegram_send",
    label: "Send Telegram Message",
    description:
      "Send a message to the user's Telegram chat. Use this to report findings or ask a question when the user is away.",
    parameters: Type.Object({
      message: Type.String({ description: "Markdown-formatted message to send." }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      await sendMessage(params.message);
      return {
        content: [{ type: "text", text: "Message sent to Telegram." }],
        details: {},
      };
    },
  });
}
```

**Install it:**

```bash
# Already auto-discovered — just reload if Pi is running:
/reload
```

Or restart Pi. You'll see "Telegram bridge active" in the session and a 🟢 message arrive on your phone.

**Usage from Telegram:**

| Message you send | What happens in Pi |
|---|---|
| `Summarise what you've done so far` | Pi receives it as a user turn and responds |
| `Stop and wait for me` | Pi processes it like any other instruction |
| `Run the tests again` | Pi executes the request in the current workspace |

> **Security note:** Only messages from `TELEGRAM_CHAT_ID` are injected. Any message from a different chat ID is silently dropped.

---

## Putting It All Together

You now have a single extension file (`telegram-bridge.ts`) that covers all three directions:

```
You (Telegram) ──► Pi  (session)  ──► You (Telegram)
                        ▲
                  LLM tool calls
                  (telegram_send)
```

**Typical workflow:**

1. Start `pi` in your project directory.
2. Receive "🟢 Pi session started" on Telegram.
3. Assign a long-running task verbally in Pi's terminal.
4. Step away — Pi works, you get "🤖 Pi is done" on your phone.
5. Reply from Telegram — "Looks good, now write the changelog."
6. Pi picks up your reply and continues.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No notification arrives | `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` unset | Check `echo $TELEGRAM_BOT_TOKEN` in your shell |
| Extension not loading | File not in an auto-discovered path | Use `pi -e ~/.pi/agent/extensions/telegram-bridge.ts` to test |
| "403 Forbidden" from Telegram API | Bot token is wrong or revoked | Re-copy token from BotFather |
| Telegram messages not injected into Pi | Chat ID mismatch | Make sure `TELEGRAM_CHAT_ID` matches the ID from `getUpdates` |
| `sendUserMessage` is not a function | Pi version too old | Run `pi update --self` |
| Group messages ignored | Bot not admin or not in group | Add bot to group and grant it message permissions |

---

**See also:** [Core Tools](core-tools.md) · [Foundation](foundation.md) · [Extending Pi](../skills/extending-pi/SKILL.md)
