# workflow

Unified task, plan, and subprocess workflow management.

## Overview

`workflow` replaces the old `task-plan` and `subprocess-orchestrator` systems with one checklist-first workflow model.

## Features

- task and plan management
- executable checklist steps
- subprocess execution
- background jobs
- active checklist UI
- migration from legacy task data
- workflow/session persistence

## Usage

### List workflows

```json
{ "action": "list" }
```

### Create a workflow

```json
{ "action": "create", "title": "Build feature", "text": "Implement the feature" }
```

### Add a step

```json
{ "action": "add-step", "id": "workflow-1", "stepText": "Run tests", "executor": "shell", "command": "npm test" }
```

### Run a workflow

```json
{ "action": "run", "id": "workflow-1" }
```

### Run a command

```json
{ "action": "run-command", "command": "npm test", "args": [] }
```

### Background job

```json
{ "action": "run-bg", "command": "npm run dev", "label": "dev server" }
```

## Checklist UI

Active workflows are rendered as checklists and remain visible until all steps are complete or skipped.

## Development

```sh
bun test core-tools/workflow
```
