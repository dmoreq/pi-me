---
description: Artifact storage — truncated tool output can be retrieved with the read tool
---

# Output Artifacts

This session has output artifact storage enabled. When tool output exceeds the context limit, the full output is saved to disk and replaced with a truncated version plus an artifact reference.

## How to Use Artifacts

When you see a message like:

```
[Full bash output (15000 chars) saved to artifact://bash-1234567890-abcde]
```

You can read the full output by calling `read` with the `artifact://` URL:

```
read({ path: "artifact://bash-1234567890-abcde" })
```

## Rules

1. Always read artifacts when you need the full tool output
2. Artifact URLs follow the format `artifact://<toolname>-<timestamp>-<random>`
3. Artifacts persist for the duration of the session
4. If an artifact URL does not resolve, it may have expired

## Storage

Artifacts are stored in `.pi/artifacts/` in the project directory.
