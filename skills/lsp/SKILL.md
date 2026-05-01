---
description: Language Server Protocol integration — auto-diagnostics and on-demand LSP queries
---

# LSP Integration

This session has Language Server Protocol (LSP) integration. The agent receives automatic diagnostics after edits and can query the language server for definitions, references, hover information, symbols, and more.

## LSP Tool

Use the `lsp` tool for on-demand queries:

- **definition**: Find where a symbol is defined
- **references**: Find all references to a symbol
- **hover**: Get type information and documentation
- **symbols**: List document symbols (filterable)
- **diagnostics**: Get diagnostics for a specific file
- **signature**: Get function signature help
- **rename**: Rename a symbol across the project
- **codeAction**: Get available code actions for a range

## Supported Languages

Dart/Flutter, TypeScript/JavaScript, Vue, Svelte, Python, Go, Kotlin, Swift, Rust, Astro

## Rules

1. Use `lsp` with `action: "diagnostics"` after making significant edits
2. Use `lsp` with `action: "definition"` to understand where symbols come from
3. Use `lsp` with `action: "references"` to find all usages before refactoring
4. The LSP hook runs auto-diagnostics at the end of each agent response
5. You can use `query` parameter to resolve symbol names instead of line/column numbers
