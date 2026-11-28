---
name: doctor
description: Check that Threadkeeper works and say how to fix what does not. Read-only. Checks the mod, sections, rules, snooze list, scheduled tasks and their models, and the wake-up and tidy report runs. Use when the Threadkeeper band or a toast says it needs attention, after a Claude desktop app update, when icons stop appearing, when a snoozed thread did not wake, after /threadkeeper:setup, or when the user says "threadkeeper doctor".
---

# Threadkeeper doctor

Read-only. Change nothing while checking. Works the same on macOS and Windows: use only your own tools (Read, Glob, the app's session, sidebar and scheduled-tasks tools), no scripts.

`HOME` is the user's home folder (`$HOME` on macOS and Linux, `%USERPROFILE%` on Windows). Threadkeeper's files are in `HOME/.claude/threadkeeper/`. Load app tools with ToolSearch when needed: `select:mcp__ccd_session_mgmt__get_session,mcp__ccd_sidebar__list_sections,mcp__ccd_session_mgmt__list_sessions,mcp__scheduled-tasks__list_scheduled_tasks,mcp__scheduled-tasks__list_task_runs`.

Get the local time now with the shell: `date +%Y-%m-%dT%H:%M:%S%z` (macOS, Linux, Git Bash) or `Get-Date -Format o` (PowerShell).

**One working day** below means: since the start time on the working day before today (from `workday` in `config.json`: `start` and `days`, a cron day list where 0 is Sunday). On a Monday with Monday to Friday, that is Friday at the start time.

## Checks

Run every check, even after a FAIL.

| # | Check | How | PASS | Otherwise, and the fix |
|---|---|---|---|---|
| 1 | Desktop app | `get_session` with `session_id: "self"` answers | Answers with a title | FAIL: "Threadkeeper needs the Claude desktop app (Code tab)." |
| 2 | Mod loaded | Read `health.json` | Exists, `version` starts with `0.6`, `checkedAt` is from today | FAIL if missing: "The plugin is not loaded in this thread. Check it is installed and turned on (Plugins in the sidebar, Your plugins), then start a new thread." FAIL if `version` is older: "The plugin was updated but this thread still runs the old one: start a new thread." WARN if `checkedAt` is older than today: "Start a new thread to refresh the check." |
| 3 | Mod's own check | `problems` in `health.json` | Empty list | FAIL: list each problem in plain words. A section that is gone: see check 6 |
| 4 | App version | `engine` in `health.json` | 2.1.287 or later | FAIL: "Update the Claude desktop app." |
| 5 | Setup done | Read `config.json` and `install-manifest.json` | Both exist and parse, and `completedAt` is set | WARN if neither exists: "Setup has not run: type /threadkeeper:setup." FAIL if the manifest exists but `completedAt` is null: "Setup stopped halfway: run /threadkeeper:uninstall, then /threadkeeper:setup." |
| 6 | Sections | `list_sections`; compare with `sections` in `config.json` (Active, and Snoozed and Done when their modules are on) | Every id is listed | FAIL per missing section: "The <name> section was deleted. Run /threadkeeper:uninstall, then /threadkeeper:setup to create it again." |
| 7 | Rules file | Read `rules.md` | Exists, contains each section id from `config.json`, has no `{{` and no `<!-- if:` | FAIL: "Run /threadkeeper:uninstall, then /threadkeeper:setup." |
| 8 | CLAUDE.md block | Read `HOME/.claude/CLAUDE.md` | Exactly one `<!-- threadkeeper:start` line, followed by `@~/.claude/threadkeeper/rules.md` and `<!-- threadkeeper:end -->` | FAIL if missing or twice: "The Threadkeeper block in CLAUDE.md is missing or doubled." Offer to fix it (see Fixes) |
| 9 | Rules loaded | Look at your own instructions for this thread: do they contain the heading "Threadkeeper rules"? | Yes | WARN: "This thread started before setup, or the CLAUDE.md block is not read. Start a new thread and run the doctor there." If it still says WARN in a new thread: FAIL, "The rules import does not load: send this output to whoever shared Threadkeeper." |
| 10 | Install record | Every `file` in `install-manifest.json` exists; every `section` id is in `list_sections` | All there | WARN per missing item |
| 11 | Snooze list (Snooze on) | Read `snooze.json`. Call `list_sessions` with group set to the Snoozed id, limit 200 | Parses, has a `snoozed` list, each entry has `session_id` and a `wake_at` with a UTC offset; no `wake_at` older than one working day | FAIL if it does not parse: "snooze.json is broken. Run /threadkeeper:uninstall, then /threadkeeper:setup (snoozed threads stay where they are)." FAIL per entry due more than one working day ago: "<bare title> should have woken on <date>: the wake-up task is not running. See checks 13 and 14." WARN per entry whose thread is not in the Snoozed section, or thread in Snoozed with no entry: "The next wake-up run tidies this up." |
| 12 | Task list (automation on) | Read `tasks.json`; compare with the `task` entries in `install-manifest.json` | Parses; every task in the manifest is in `tasks.json` | FAIL if it does not parse. WARN per task in only one of the two lists |
| 13 | Each recorded task | For every task in `tasks.json` and the manifest: find it in `list_scheduled_tasks`, then Read the file at its `path` | Listed; enabled (a follow-up whose `fireAt` has passed is expected to be disabled: PASS); no `notRead`; its frontmatter has `model: claude-sonnet-5-5` (or the model in `tasks.json`); no `waiting` note | FAIL if missing: "The task <name> is gone. Run /threadkeeper:uninstall, then /threadkeeper:setup." FAIL if a recurring task is disabled: "Turn <name> back on under Scheduled in the sidebar." FAIL if the `model:` line is missing or different: "The task <name> would run on the app's default model." Offer to fix it (see Fixes). WARN with the text of `waiting` or `notRead` if there is one |
| 14 | Wake-up runs (Snooze on) | Read `sweep-heartbeat.json`. Also `list_task_runs` for `threadkeeper-wake-sweep`, limit 3, and `lastTurnAt` in `health.json` | `last_run` within one working day and `result` is "ok" | Not there yet and the task was made less than one working day ago: PASS, "Not run yet. First run: <nextRunAt>." `result` is not "ok": WARN with the result in plain words. Older than one working day: FAIL "The wake-up task has not run although the app was used" if `lastTurnAt` is more than one hour after a run time the heartbeat missed (a run time from the task's cron, after `last_run`), else WARN "The app was closed or the computer asleep at the run times: it catches up at the next chance." A run in `list_task_runs` that failed or has been "running" for more than an hour: WARN with its error or "it may be waiting for a permission click: open that run under Scheduled." |
| 15 | Tidy report runs (Tidy report on) | Read `tidy-heartbeat.json`; `list_task_runs` for `threadkeeper-tidy-report`, limit 3 | Same as check 14 | Same as check 14, with "tidy report" in place of "wake-up" |
| 16 | Stray tasks | `list_scheduled_tasks`: tasks whose name starts with `threadkeeper-` | Every one is in `tasks.json` | WARN per task not in the list: "<name> looks like a Threadkeeper task but is not recorded. Uninstall will not remove it: delete it under Scheduled if you do not want it." |

Skip checks 6 to 16 when check 5 says setup has not run. Skip checks 11 to 16 for modules that are off.

## Report

Show one table: Check, Result (PASS, WARN or FAIL), What it means (plain words), Fix. Then one line: "All good" or "N things need a fix".

If the user will send the report to someone, add these lines under the table: the operating system, `version` and `engine` from `health.json`, and `modules` from `config.json`. Never include thread titles or file contents.

## Fixes

Offer the fixes from the table. Apply one only after the user says yes, one at a time, then run the checks again.

- CLAUDE.md block missing: append the three block lines from the setup skill (step 8, item 6) at the end of `CLAUDE.md`. Block doubled: remove the second copy only. Never change any other line.
- A task's model line missing or different (check 13): Read the task's `SKILL.md` at its `path`. With Edit, add `model: claude-sonnet-5-5` (or the model in `tasks.json`) directly before the second `---` line, or change the existing `model:` line. Change nothing else. Read it again to check.
- Anything else: the fix is /threadkeeper:uninstall and then /threadkeeper:setup. Do not repair files by hand.
- Never move, rename, close or delete threads, and never create, change or delete tasks, as part of a fix.
