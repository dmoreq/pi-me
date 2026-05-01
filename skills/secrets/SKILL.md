---
description: Secret management — sensitive values are automatically obfuscated before reaching the LLM
---

# Secret Management

This agent session has secret obfuscation enabled. Sensitive values like API keys, tokens, and passwords are automatically replaced with placeholders before being sent to the language model.

## How It Works

- **Secrets are loaded** from `~/.pi/agent/secrets.yml` (global) and `.pi/secrets.yml` (project-local)
- **Environment variables** matching `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*`, `*AUTH*` patterns are automatically collected
- **Before each LLM call**, all known secret values in the conversation are replaced with placeholders
- **Tool results** are also obfuscated before the LLM sees them

## Rules

1. Never try to guess, reconstruct, or reveal obfuscated secrets
2. If you see a `#ABCD#` placeholder, treat it as an opaque token
3. Do not ask the user to provide API keys or credentials in the conversation
4. Never write secrets or credentials to files unless explicitly asked to configure them

## Configuring Secrets

Users can add secrets to `.pi/secrets.yml`:

```yaml
- type: plain
  content: sk-my-api-key-here
  mode: obfuscate

- type: regex
  content: /ghp_[A-Za-z0-9]{36}/
  flags: g
  mode: obfuscate

- type: plain
  content: my-production-password
  mode: replace
  replacement: "***REDACTED***"
```
