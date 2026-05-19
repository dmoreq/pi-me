---
name: plugin-guide
description: Use when choosing between Pi tools, skills, extensions, or workflows for a task.
---

# Plugin Guide

Use this guide to pick the current Pi-native tool or skill.

## Task-to-Tool Mapping

### Progress & planning

| Task | Tool / Skill |
|---|---|
| Track in-session progress | `workflow` |
| Create/update workflows | `workflow` |
| Run command/background job as tracked work | `workflow run-command` / `workflow run-bg` |
| Review jobs | `workflow job-list` / `job-status` / `job-cancel` |

### Code work

| Task | Tool |
|---|---|
| Search file contents by regex | `search` |
| Search by meaning | `concept_search` |
| Find file paths | `find_files` / `fuzzy_find` |
| Read structured files | `read_enhanced` |
| Read images/text | `read` |
| Edit files | `edit` |
| Write files | `write` |
| Run shell commands | `bash` |
| Structural code refactors | `ast_grep` |
| Security/code-smell checks | `semgrep` |

### Web + external info

| Task | Tool |
|---|---|
| Search the web | `web_search` |
| Fetch a known URL | `web_fetch` |

### Commit + replay

| Task | Tool |
|---|---|
| Generate/perform commit | `/commit` + `commit_message` |
| Replay a prior bash/edit/write call | `/repeat` |

### Skills

| Task | Skill |
|---|---|
| Create or update skills | `writing-skills` |
| Debug bugs/tests | `systematic-debugging` |
| Write tests first | `test-driven-development` |
| Extend Pi | `extending-pi` |

## Choosing between similar tools

- Use `concept_search` for questions like “where is auth handled?”
- Use `search` when you know the exact pattern.
- Use `read_enhanced` for JSON/YAML/manifests and large files.
- Use `workflow` instead of old todo/task/subprocess references.
- Use `web_search` first, then `web_fetch` for the source URL.
