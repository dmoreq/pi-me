---
name: skill-bootstrap
description: Skill bootstrap — the /bootstrap-skill command can generate project skills
---

# Skill Bootstrap

This session has the skill bootstrap extension active. The `/bootstrap-skill` command can generate a `SKILL.md` file for the current project.

## How to Use

1. Run `/bootstrap-skill` to scan the project and generate a SKILL.md
2. The skill file is saved to `.pi/skills/<project-name>/SKILL.md`
3. Future sessions will automatically load the skill

## When to Bootstrap

- When starting work on an unfamiliar repository
- When the project structure has changed significantly
- When you need to document project conventions for other agents

## Rules

1. Use `/bootstrap-skill` at the start of a new project
2. If the generated skill is incomplete, suggest improvements to the user
3. The bootstrap command can be re-run to regenerate the skill after project changes
