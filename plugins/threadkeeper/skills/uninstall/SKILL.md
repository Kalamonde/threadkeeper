---
name: uninstall
description: Remove everything Threadkeeper setup added (scheduled tasks it made, rules, its files, the CLAUDE.md block, optionally its sections, snoozed threads back to Active, and the icons and wake times in thread titles), using the install record, then explain how to remove the plugin itself. Use when the user types /threadkeeper:uninstall or wants Threadkeeper gone, or before running setup again to change modules.
---

# Threadkeeper uninstall

Follow these steps in order. Remove only what the install record and the task list name. If anything fails or looks different from what this file expects, stop and say what happened.

`HOME` is the user's home folder (`$HOME` on macOS and Linux, `%USERPROFILE%` on Windows). Threadkeeper's files are in `HOME/.claude/threadkeeper/`.

## 1. Read the record

Read these files in `HOME/.claude/threadkeeper/` (each may be missing): `install-manifest.json`, `config.json`, `tasks.json`, `snooze.json`.

- The Threadkeeper tasks are the union of the `task` entries in `install-manifest.json` and the `tasks` in `tasks.json` (by `name`). Only these may be deleted.
- No `install-manifest.json`: say setup never ran (or its record is gone). If `tasks.json` lists tasks, offer to delete those (step 3). Check `HOME/.claude/CLAUDE.md` for a `<!-- threadkeeper:start` block and offer to remove it (step 6). Then go to step 8.

## 2. Show the plan, ask once

Load `mcp__scheduled-tasks__list_scheduled_tasks`, `mcp__ccd_sidebar__list_sections` and `mcp__ccd_session_mgmt__list_sessions` with ToolSearch. Count the threads in the Snoozed section, if there is one (list_sessions with its group id).

List what will be removed:

- The scheduled tasks Threadkeeper made (name each one). The app keeps a copy of each task's text in its own task folder; that copy does nothing once the task is deleted.
- The Threadkeeper block in `HOME/.claude/CLAUDE.md` (3 lines). If setup created `CLAUDE.md` and it holds nothing else, the file itself.
- The files `config.json`, `rules.md`, `health.json`, `snooze.json`, `tasks.json`, `sweep-heartbeat.json`, `tidy-heartbeat.json`, `task-followup-wake.md` and `install-manifest.json` in `HOME/.claude/threadkeeper/` (those that exist).
- Kept: the backup folders in `HOME/.claude/threadkeeper/` (say their names), so nothing is lost.

If `list_scheduled_tasks` shows tasks whose name starts with `threadkeeper-` that are in neither list, name them and say: "These look like Threadkeeper tasks but are not recorded, so uninstall leaves them. Delete them under Scheduled in the sidebar if you do not want them."

Then ask ONE AskUserQuestion call with the questions that apply:

1. If the record lists sections: "What should happen to the Threadkeeper sidebar sections (<names>)?"
   - "Keep them (recommended)": they stay as normal sections with their threads.
   - "Delete them": the threads in them go back to the plain list. Nothing else is deleted.
2. If Snooze was on and the Snoozed section holds threads, or `snooze.json` has entries: "What should happen to the <N> snoozed threads?"
   - "Move them back to <Active name> (recommended)": they come back to your active threads now.
   - "Leave them where they are".
3. "Remove the Threadkeeper icons from thread titles?"
   - "Yes, Threadkeeper's icons (recommended)": removes a leading ⏳ ❓ 🟢 ⚠️ from every thread title, ✅ only from threads in the Threadkeeper Done section, and ⏰ with its wake time only from Threadkeeper's snoozed threads. A ✅ or ⏰ from another tool stays. Nothing else in the titles changes.
   - "Only ⏰ and wake times": only on the threads that are snoozed now (in the Snoozed section or in `snooze.json`).
   - "No, leave them".

Then ask "Remove Threadkeeper now?" with "Yes, remove it" and "Cancel". On Cancel: stop, nothing changed.

## 3. Scheduled tasks first

Delete them before anything else, so no run starts halfway through. Load `mcp__scheduled-tasks__delete_scheduled_task` with ToolSearch. For each Threadkeeper task from step 1:

- Listed in `list_scheduled_tasks`: call `delete_scheduled_task` with its name. If it is refused: stop.
- Not listed: note "already gone".

Never delete any other task. Say how many tasks were deleted.

## 4. Snoozed threads (if chosen)

Skip this step if the user chose to delete the sections: the threads go to the plain list when the sections go.

Load `mcp__ccd_sidebar__move_sessions` with ToolSearch. Call list_sessions with the Snoozed section id as group, limit 200. Move those threads, and only those, with one move_sessions call: session_ids [their ids], section_id the Active id from the record. Say how many were moved.

## 5. Titles (if chosen)

Load `mcp__ccd_session_mgmt__set_session_title` with ToolSearch.

- "Yes, Threadkeeper's icons": first make two lists while the sections still exist: the Done threads (list_sessions with the Done section id from the record as group, archived ones too, limit 500) and the snoozed threads (as for "Only ⏰ and wake times" below). Then list sessions (archived ones too, limit 500) and skip scheduled task runs. For each title: remove leading ⏳ ❓ 🟢 ⚠️; remove a leading ✅ only if the thread is on the Done list; remove a leading ⏰ and the wake time after it (like `11-05 Thu 09 `) only if the thread is on the snoozed list. Set the cleaned title only if it changed. Never remove a ✅ or ⏰ from any other thread: it may come from the user's own setup.
- "Only ⏰ and wake times": the threads from step 4 (or still in the Snoozed section) and the threads whose `session_id` is in `snooze.json`. For each title that starts with ⏰: remove the ⏰ and the wake time after it, and set the cleaned title.

A refused rename (a title the user typed): skip it and count it. Say how many titles were cleaned and how many were skipped. This thread may get one icon back when this turn ends: it goes when the plugin is removed in step 8.

## 6. CLAUDE.md block

Read `HOME/.claude/CLAUDE.md`. Remove the lines from `<!-- threadkeeper:start` to `<!-- threadkeeper:end -->` (inclusive) and one empty line right before them, if there is one. Change nothing else. If the record says setup created the file and it is now empty, delete the file.

## 7. Files and sections

- Delete the files listed in the record, and `health.json`, `snooze.json`, `tasks.json`, `sweep-heartbeat.json`, `tidy-heartbeat.json` and `task-followup-wake.md` if they exist, with the shell (macOS and Linux: `rm`, Windows: `Remove-Item`), one path at a time. Leave the backup folders.
- Sections, if the user chose to delete them: load `mcp__ccd_sidebar__delete_section` with ToolSearch and delete only the section ids in the record.
- Delete `install-manifest.json` last.

## 8. Remove the plugin

Tell the user how to remove the plugin itself, which only they can do:

- Desktop app: Plugins in the sidebar (Your plugins), Threadkeeper, Uninstall. Then remove the "threadkeeper" marketplace there if they do not want updates.
- Terminal: `claude plugin uninstall threadkeeper@threadkeeper`, then `claude plugin marketplace remove threadkeeper`.

Finish with one line: what was removed (tasks, files, sections, titles cleaned, threads moved) and where the backups are.
