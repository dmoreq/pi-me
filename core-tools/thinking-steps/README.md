# thinking-steps

Thinking display helper for Pi.

## What it does

- renders thinking in collapsed, summary, expanded, or hidden mode
- detects step-like reasoning text
- persists preferences per session, project, or global default
- updates the hidden thinking label while the assistant is reasoning

## Modes

- **collapsed**: compact count only
- **summary**: bullet summary of detected steps
- **expanded**: native Pi thinking renderer
- **hidden**: hides the thinking label

## Commands

- `/thinking-steps` — cycle the view
- `/thinking-steps collapsed|summary|expanded|hidden`
- `/thinking-steps project <mode|clear>`
- `/thinking-steps global <mode|clear>`

## Shortcut

- `Alt+T` cycles the thinking view

## Persistence

Preference order:

1. session entry
2. project default
3. global default
4. built-in default (`summary`)

## Development

```sh
bun test core-tools/thinking-steps
```
