---
name: start-work
description: Start (or resume) a focused work session from a prompt. Creates a git-ignored work plan and progress log under .work/ and uses them as the session's working context. Use when the user runs /start-work, or says "start work on…", "let's begin…", "new task:", or wants to pick a previous workstream back up.
argument-hint: <what you want to work on>
---

# start-work

Turn the user's prompt into a local, git-ignored **plan** and **progress log**
that anchor this session (and survive context compaction or a new session).
At the end, `/finish-work` promotes what is worth keeping into `docs/knowledge/`.

The prompt is: `$ARGUMENTS`. If it is empty, ask what they want to work on, in one question.

## 1. Check for existing workstreams

List `.work/*/plan.md` and read the frontmatter of each with `status: active`.

- If one clearly matches the prompt, **resume it**: read its `plan.md` and the
  tail of `progress.md`, write `.work/CURRENT` with that folder name, append a
  `Resumed` entry to the progress log, and summarize where things stand. Stop here.
- If others are active but unrelated, mention them in one line and continue.

## 2. Load durable context

`CLAUDE.md` and `docs/knowledge/patterns.md` are already in context. Also:

- Grep `docs/knowledge/workstreams/` for keywords from the prompt and read any
  related past workstreams: they hold decisions and gotchas from earlier sessions.
- Look at the code the task touches. Only read enough to write a grounded plan.
  Do not start implementing yet.

## 3. Create the work folder

Folder: `.work/YYYY-MM-DD-<slug>/` (today's date, a 2–5 word kebab-case slug).
Write `.work/CURRENT` containing just the folder name.

Record the current commit (`git rev-parse --short HEAD`, or `none` if the
repo has no commits) as `base` so finish-work can diff the session's changes.

### plan.md

```markdown
---
title: <short title>
status: active
started: YYYY-MM-DD
base: <short sha | none>
branch: <current branch>
---

# <title>

## Goal
<1–3 sentences: the outcome, in the user's terms. Quote the prompt if it helps.>

## Context
- <relevant facts found in code / knowledge docs, with file links>
- <constraints: schema stability, Heroku, downstream consumers, …>

## Approach
<short paragraph: the chosen approach and why>

## Steps
- [ ] <small, verifiable step>
- [ ] …
- [ ] Verify: <tests / typecheck / manual check that proves it works>

## Out of scope
- <things deliberately not done now>

## Open questions
- <only real unknowns the user must answer>
```

### progress.md

```markdown
# Progress: <title>

## YYYY-MM-DD HH:MM: Started
- Prompt: "<original prompt>"
- Plan created; <n> steps.
```

## 4. Confirm, then work

Show the user the goal, the steps, and any open questions in a few lines. If
there are open questions that change the approach, ask them now; otherwise proceed.

## During the session (keep these files alive)

- **Append to `progress.md`** at meaningful moments, not every tool call:
  a step finished, a decision made (and *why*), a surprise or gotcha found,
  a blocker, a test result. Use `## YYYY-MM-DD HH:MM: <headline>` and short bullets.
  Record failures honestly, with the actual error.
- **Update `plan.md`**: tick steps, add or reorder steps when the plan changes,
  and note why in progress.md.
- After a context compaction or when unsure what's next, re-read `.work/CURRENT`,
  `plan.md` and the end of `progress.md` before continuing.
- `.work/` is git-ignored: never `git add -f` it, and never put secrets in it.

When the work is done (or the user wants to stop), suggest `/finish-work`.
