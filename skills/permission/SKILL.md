---
name: permission
description: Permission control — layered access with safety nets for dangerous commands and protected paths
---

# Permission Control

This session has layered permission control with hard safety nets.

## Permission Levels

| Level | Description |
|-------|-------------|
| Minimal | Read-only (ls, cat, grep, git status) |
| Low | + File write/edit |
| Medium | + Dev operations (npm, git commit, build) |
| High | Full operations (git push, deployments) |

## Safety Nets (Always Active)

### Dangerous Commands
The following are always flagged regardless of tier: `sudo`, `rm -rf`, `chmod 777`, `curl | sh`, `git push --force`, `git reset --hard`, `dd` to block devices, fork bombs, and more.

### Protected Paths
These files are write-protected: `.env*`, `*.key`, `*.pem`, SSH keys, lock files, CI workflows, `.npmrc`, `.pypirc`, and credential files.

## Commands

- `/permission` — View or change permission level  
- `/permission-mode` — Switch between ask and block modes
- `/permission config show` — Show custom overrides

## Rules

1. Respect the current permission level — don't try to bypass it
2. Safety net violations require explicit user confirmation even at high tier
3. Use `/permission medium` when you need dev-ops capabilities
4. The bypassed level disables all checks (use with caution)
