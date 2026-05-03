---
name: btw-task
description: Handle "by the way" task requests. Use when the user says "btw do X, Y, and Z" or types "/btw X, Y, Z" to queue parallel tasks.
---

# btw-task — By The Way Task Dispatcher

When the user says "btw do X, Y, Z" or types `/btw X, Y, Z`:

1. The extension automatically captures the tasks, plans dependencies, and executes them
2. Parallel tasks run simultaneously via sub-pi
3. A widget shows the 3 most recent tasks above the editor

## Usage

```
/btw fix login bug, refactor db schema, update api docs
btw also deploy to staging and notify the team
```

## Commands

- `/btw <tasks>` — Add and execute tasks
- `/btw-clear` — Clear all btw tasks
- `/btw-clear completed` — Clear only completed/failed tasks

## Behavior

- Tasks sharing a topic (e.g., "fix login" and "test login") run sequentially
- Independent tasks run in parallel
- Only 3 most recent tasks shown in the widget
- Completed tasks are auto-pruned from the widget
