---
name: finish-work
description: Wrap up the current work session started with /start-work. Closes out the local plan and progress log, then promotes durable knowledge (decisions, patterns, gotchas, follow-ups) into the committed docs/knowledge/ folder for future sessions. Use when the user runs /finish-work, or says "wrap up", "we're done", "finish this workstream", or "save what we learned".
argument-hint: [optional notes about what to keep or how it ended]
---

# finish-work

Close the active workstream and turn its session notes into **long-term
memory**: small, curated, committed docs that later sessions (human or AI) load.

Extra notes from the user: `$ARGUMENTS`

## 1. Gather the session

- Read `.work/CURRENT`. If it's missing, list `.work/*/plan.md` with
  `status: active`; if exactly one, use it, otherwise ask which one.
- Read `plan.md` and all of `progress.md`.
- See what actually changed: `git status`, plus `git diff --stat <base>` and
  `git log --oneline <base>..HEAD` when `base` is a commit (use the working tree
  if `base: none`).
- Check the verification state. Run the plan's verify step(s) (usually
  `pnpm typecheck` and `pnpm test`) if that hasn't been done since the last change.

## 2. Close out the local files

- Append a final `## YYYY-MM-DD HH:MM: Finished` entry to `progress.md`:
  what got done, what didn't, and the verification result (state failures plainly).
- In `plan.md`, tick completed steps and set `status: done` (or `paused` if the
  user is stopping mid-way; then skip step 3 except for anything clearly durable).
- Delete `.work/CURRENT`. Leave the folder in place; it's local and git-ignored.

## 3. Promote durable knowledge

Ask of every candidate: *would a future session make a worse decision without
this, and can it NOT be recovered from the code or git history?* Only promote
what passes. Prefer updating an existing entry over adding a new one.

### a. Workstream record: `docs/knowledge/workstreams/YYYY-MM-DD-<slug>.md`

One per workstream, ~20–60 lines. Not a narrative of the session.

```markdown
# <title>

- **Date:** YYYY-MM-DD · **Status:** done | paused · **Branch:** <branch>

## Outcome
<what now exists or changed, 2–5 bullets, linking key files>

## Decisions
- <decision>: <why; alternatives rejected>

## Gotchas
- <surprising behavior, vendor quirk, tooling trap, and how it was handled>

## Follow-ups
- [ ] <concrete next step>
```

### b. Patterns: `docs/knowledge/patterns.md`

This file is imported by `CLAUDE.md`, so it is in **every** session's context.
Keep it short (target under ~120 lines) and current:

- Add a pattern only if it is reusable beyond this workstream (a convention,
  a "how we do X here", a recurring trap). One or two lines each, under the right heading.
- Edit or remove entries this session proved wrong or outdated.
- Link to the workstream record for detail instead of copying it.

### c. Other places, only when warranted

- `CLAUDE.md`: if commands, layout, or architecture changed.
- `docs/*.md` (e.g. `docs/heroku.md`, `docs/architecture.md`): if the work
  changed how something is deployed or structured.
- Claude's personal auto-memory: only for preferences about how *this user*
  likes to work (not project facts; those go in the repo so the whole team gets them).

**Never promote:** secrets or credentials, raw logs, step-by-step transcripts,
file inventories, anything already obvious from the code.

## 4. Report

Tell the user, briefly:
- what was finished, and the verification result
- what was promoted, and where (file links)
- open follow-ups

Don't commit unless the user asks. If they do, the knowledge docs belong in the
same commit as the code they describe.
