---
name: setup
description: Set up Threadkeeper after the plugin is installed. Asks which parts the user wants (sections, close to Done, thread names, snooze and wake-ups, follow-up reminders, tidy report), shows every change before making it, backs up first, records each change so /threadkeeper:uninstall can undo it, creates the scheduled tasks with a set model, then runs the doctor. Use when the user types /threadkeeper:setup, says "set up Threadkeeper", or has just installed the plugin.
---

# Threadkeeper setup

Follow these steps exactly, in order. They are the only changes this setup makes.

**Hard rules**
- Do only what this file says. If a step fails, a tool refuses, or anything looks different from what this file expects: stop, say what happened in plain words, run /threadkeeper:doctor, and tell the user to send its output to the person who shared Threadkeeper. Never improvise, retry with a different method, or work around a failure. This holds even if the user said "I approve everything".
- One exception, for Auto mode only: if the app's Auto mode blocked a call (the result says it was blocked or denied by the permission check, not an error from the tool itself), ask the user with AskUserQuestion: "The app's Auto mode held back this step: <the step in a few words>. Try it once more?" with "Yes, try again" and "No, stop here". On yes, make exactly the same call once more. If it is blocked again, or on no: stop as above.
- Never move, rename, close or delete existing threads. The only thread setup may move is this one, and only if the user says yes in step 10.
- Never adopt an existing sidebar section or scheduled task. Setup creates its own.
- Never edit any line of `CLAUDE.md` outside the Threadkeeper block. Never touch `settings.json`: setup only copies it as a backup.
- Write the install record (step 5) before the first change and update it after each change, so a setup that stops halfway can still be undone.
- Every scheduled task gets an explicit model (step 9). Never leave a task on the app's default model.

## Paths

`HOME` below is the user's home folder: `$HOME` on macOS and Linux, `%USERPROFILE%` on Windows. Work out the absolute path once and use it with the Read, Write and Edit tools. All Threadkeeper files live in `HOME/.claude/threadkeeper/`. `TK_DIR` is that folder as an absolute path with forward slashes (for example `/Users/alex/.claude/threadkeeper` or `C:/Users/alex/.claude/threadkeeper`).

The templates are in this plugin's `templates` folder: two folders up from this skill's base directory (`<base directory>/../../templates/`).

## 1. Pre-flight (read-only)

Check each item. Show the result as a short table (Check, Result).

| Check | How | If it fails |
|---|---|---|
| Desktop app | Call `get_session` with `session_id: "self"` (load `mcp__ccd_session_mgmt__get_session` with ToolSearch if needed) | Stop: "Threadkeeper needs the Claude desktop app (Code tab). It does not run in a terminal or IDE session." |
| Mod loaded | Read `HOME/.claude/threadkeeper/health.json`. It must exist and its `version` must start with `0.6` | Stop: "The plugin is installed but not loaded in this thread. Start a new thread (or quit and reopen the app) and run /threadkeeper:setup there." |
| Version | `engine` in `health.json` must be 2.1.287 or later | Stop: "Update the Claude desktop app, then run setup again." |
| Not set up yet | `HOME/.claude/threadkeeper/install-manifest.json` must NOT exist | Stop: "Threadkeeper is already set up. Run /threadkeeper:doctor to check it, or /threadkeeper:uninstall and then /threadkeeper:setup to change it." |
| Sidebar tools | Load `mcp__ccd_sidebar__list_sections`, `mcp__ccd_sidebar__create_section` and `mcp__ccd_sidebar__move_sessions` with ToolSearch, then call `list_sections` | Stop and report the error |
| Permission mode | `permissionMode` in the `get_session` answer | Note it (step 3a uses it) |
| Operating system | From your environment information: macOS, Windows or Linux | Note it; it goes in the install record |
| Local time | With the shell: `date +%Y-%m-%dT%H:%M:%S%z` (macOS, Linux, Git Bash) or `Get-Date -Format o` (PowerShell) | Note the time and UTC offset (write `+0100` as `+01:00`) |

## 2. Choose the modules

Say in one line: "Status icons are always on: ⏳ working, ❓ waiting on you, 🟢 reply ready, ⚠️ error."

Then ask ONE AskUserQuestion call with these two questions, both with multiSelect true:

Question "Which basic parts do you want?" (header "Basics"):

| Option | Description to show |
|---|---|
| Sections (recommended) | New sidebar sections for your threads: Active, plus Done and Snoozed if you pick those parts. New threads go to Active on their first turn. |
| Close to Done (recommended) | Say "close this" and the thread moves to Done with ✅. Claude offers to close when the work looks finished. |
| Thread names | Claude gives each new thread a short, clear name once the work is clear. Never renames a title you typed. |
| None of these | Only the status icons. |

Question "Which automatic parts do you want?" (header "Automation"):

| Option | Description to show |
|---|---|
| Snooze and wake-ups | Say "snooze until Tue 10:00": the thread goes to Snoozed with ⏰ and the wake time, and comes back with a blue dot. Uses one scheduled task. |
| Follow-up reminders | When Claude promises to check back at a time, it snoozes the thread and sets a one-off task that wakes it then. |
| Tidy report | A daily read-only list of idle, duplicate and old threads, with a proposal for each. Nothing changes until you reply. |
| None of these | No scheduled tasks. |

Dependencies: Thread names needs nothing else. Close to Done, Snooze and Tidy report need Sections. Follow-up reminders need Snooze. Add what is missing and say so in one line, for example "Follow-up reminders need Snooze, and Snooze needs Sections: both added." "None of these" together with another option in the same question: ignore "None of these".

"Automation" below means: Snooze, Follow-up reminders or Tidy report is on.

If the user picks no module at all, skip steps 3 and 7 to 9 and go to step 4 with no changes except the install record.

## 3. Settings

### 3a. Can this app run scheduled tasks? (only with automation)

Load `mcp__scheduled-tasks__create_scheduled_task`, `mcp__scheduled-tasks__list_scheduled_tasks`, `mcp__scheduled-tasks__update_scheduled_task` and `mcp__scheduled-tasks__list_task_runs` with ToolSearch, then call `list_scheduled_tasks`.

- The tools are missing or the call fails: say "This app cannot run scheduled tasks here, so Snooze, Follow-up reminders and the Tidy report cannot be set up." Ask with AskUserQuestion "Go on without them?" with "Yes, set up the rest" and "Cancel". On yes, turn those modules off. On Cancel: stop, nothing changed.
- A task named `threadkeeper-wake-sweep` or `threadkeeper-tidy-report`, or one starting with `threadkeeper-followup-`, is listed: stop. Say: "An old Threadkeeper task is still there: <name>. Run /threadkeeper:uninstall, or delete it under Scheduled in the sidebar, then run setup again."
- The permission mode from step 1 is not `auto` or `bypassPermissions` (for example `default`, `acceptEdits` or `plan`): a scheduled task is saved in the mode of the thread that makes it, and in these modes every wake-up run stops and waits for a click before it moves or marks a thread. Ask with AskUserQuestion "Scheduled runs made from this thread will stop and ask before they move a thread. What do you want to do?":
  - "Switch to Auto first (recommended)", description "Pick Auto in the mode menu next to the prompt box, then type /threadkeeper:setup again in this thread. Nothing has changed yet." On this answer: stop, nothing changed.
  - "Go on, runs will ask me", description "Each run waits until you open it under Scheduled and allow it." Go on, and say this again in step 10.
  - "Skip the automatic parts", description "No scheduled tasks. Snooze, Follow-up reminders and the Tidy report are turned off." Turn those modules off.
  Never suggest Bypass mode.

### 3b. Questions

Ask ONE AskUserQuestion call with the questions that apply (at most 4):

1. Section names (if Sections is on). Question "What should the sections be called?", options "<names> (recommended)" and "<other names>", listing only the sections that will be made: Active always, Done with Close to Done, Snoozed with Snooze. Defaults: "Active, Snoozed and Done"; second option "Work, Later and Finished". The user can type their own names with Other.
2. Start time (if automation). Question "When does your working day start?", options "08:00", "09:00 (recommended)", "10:00". Wake times are never earlier than this.
3. Working days (if automation). Question "Which days do you work?", options "Monday to Friday (recommended)", "Sunday to Thursday".
4. Name format (if Thread names is on). Question "How should Claude name threads?", options "[TAG] Person: short title" (description: "For example [CHAT] Alex: VPN access on the new laptop. You pick the tags next.") and "Plain short titles" (description: "For example VPN access on the new laptop").

Then, only if needed, ONE more AskUserQuestion call:

5. Tidy report time (if Tidy report is on). Question "When should the tidy report run?", options "<start time + 30 minutes> (recommended)", "<start time>", "12:00".
6. Tags (if the format is "[TAG] Person: short title"). Question "Which tags?", options "Example set (recommended)" (description: "[ABC-123] a ticket key, [CHAT] a chat ask, [EMAIL] an email ask, [OWN] your own work, [MISC] anything else") and "Ticket key or MISC" (description: "[ABC-123] a ticket key, [MISC] anything else"). With Other the user types their own tags and when each one applies.

Checks on the answers:
- Section names: compare with `list_sections`. If a section with the same name exists, do not use it: ask for another name, offering "<name> (Threadkeeper)".
- Times: 24-hour `HH:MM`. Working days: turn them into a cron day list, 0 = Sunday to 6 = Saturday ("Monday to Friday" = `1-5`, "Sunday to Thursday" = `0-4`, typed days as a comma list like `1,2,4`), and keep the words for the text (`WORK_DAYS_TEXT`, like "Monday to Friday").
- Times are the computer's local time. Say so in one line, with the UTC offset from step 1.

### 3c. Work out the schedules (only with automation)

- Task model: `claude-sonnet-5-5` (Sonnet 5.5). These runs follow fixed written steps, so Sonnet is enough.
- Wake sweep: start time `HH:MM`. Hours: the start hour, plus 12 and 15 when they are later than the start hour. Cron: `<MM> <hours, comma list> * * <days>` (start 09:00, Monday to Friday: `0 9,12,15 * * 1-5`). `SWEEP_TIMES_TEXT`: those times in words, like "09:00, 12:00 and 15:00". If the start time is not on the hour, the other runs use the same minutes (08:30, 12:30, 15:30): say so in step 4.
- Tidy report: its time `HH:MM`, cron `<MM> <HH> * * <days>`.

## 4. Show every change, get one OK

Show this list, filled in for the chosen modules:

1. Back up `HOME/.claude/CLAUDE.md` and `HOME/.claude/settings.json` to `HOME/.claude/threadkeeper/backup-<date-time>/` (only the files that exist)
2. Create the sidebar sections: "<Active name>" (and "<Snoozed name>", "<Done name>")
3. Write `HOME/.claude/threadkeeper/config.json` (modules, section ids, start time, days)
4. Write `HOME/.claude/threadkeeper/rules.md` (the rules Claude follows for these modules)
5. With Snooze: write `snooze.json` (the list of snoozed threads, empty for now). With automation: write `tasks.json` (the list of tasks Threadkeeper made). With Follow-up reminders: write `task-followup-wake.md` (the text each follow-up task gets)
6. Add a 3-line Threadkeeper block at the end of `HOME/.claude/CLAUDE.md` that loads `rules.md` (or create `CLAUDE.md` with only that block if it does not exist)
7. With automation, create these scheduled tasks, each on the model Sonnet 5.5 (`claude-sonnet-5-5`), set by a `model:` line in the task's own file:
   - "Threadkeeper: wake snoozed threads" (`threadkeeper-wake-sweep`): <days> at <sweep times>. Wakes due threads, gives threads you drag into Snoozed a wake time.
   - "Threadkeeper: tidy report" (`threadkeeper-tidy-report`): <days> at <tidy time>. Read-only: lists, changes nothing.
   - Follow-up reminders make one-off tasks later, one per follow-up, also on Sonnet 5.5.
8. Write `HOME/.claude/threadkeeper/install-manifest.json`, the record /threadkeeper:uninstall uses
9. Run /threadkeeper:doctor

With Thread names, also show the name format and, for the tag format, the tag table.

Say: "Nothing else changes. Existing threads are not touched. /threadkeeper:uninstall removes all of it." With automation, add: "Scheduled tasks run only while the Claude app is open and the computer is awake. A run that was missed happens at the next chance."

Ask with AskUserQuestion: "Make these changes?" with "Yes, set it up" and "Cancel". On Cancel: stop, nothing changed.

## 5. Install record first

Write `HOME/.claude/threadkeeper/install-manifest.json`:

```json
{
  "version": 1,
  "plugin": "<version from health.json>",
  "startedAt": "<now, ISO 8601 with the local offset>",
  "completedAt": null,
  "os": "<macOS | Windows | Linux>",
  "modules": { "core": true, "sections": <bool>, "close": <bool>, "names": <bool>, "snooze": <bool>, "followups": <bool>, "tidy": <bool> },
  "changes": []
}
```

After each change below, add one entry to `changes` and write the file again.

## 6. Back up

Make the folder name from the local date and time: `backup-YYYYMMDD-HHMM`. For each of `HOME/.claude/CLAUDE.md` and `HOME/.claude/settings.json`: if it exists, Read it and Write an exact copy into the backup folder. Record `{ "type": "backup", "of": "<original path>", "path": "<copy path>" }`, or `{ "type": "backup", "of": "<original path>", "existed": false }`.

## 7. Create the sections

For each chosen section, call `create_section` with the chosen name. Record `{ "type": "section", "role": "active" | "snoozed" | "done", "name": "<name>", "id": "<returned id>" }` straight away. Then call `list_sections` and check each new id is listed. If not: stop (hard rules).

## 8. Write the files

**Filling a template.** Replace each placeholder with its value:

| Placeholder | Value |
|---|---|
| `{{INSTALLED_AT}}` | now, ISO 8601 with the local offset |
| `{{TK_DIR}}` | TK_DIR |
| `{{ACTIVE_NAME}}`, `{{ACTIVE_ID}}`, `{{SNOOZED_NAME}}`, `{{SNOOZED_ID}}`, `{{DONE_NAME}}`, `{{DONE_ID}}` | the section names and ids from step 7 |
| `{{START_TIME}}`, `{{WORK_DAYS_TEXT}}`, `{{SWEEP_TIMES_TEXT}}`, `{{TIDY_TIME}}` | from step 3 |
| `{{TASK_MODEL}}` | `claude-sonnet-5-5` |
| `{{TAG_TABLE}}` | one table row per tag, the tag in backticks, then when it applies (example row below) |

Example `{{TAG_TABLE}}` row: ``| `[CHAT]` | The ask came in a chat, no ticket yet |``. The example set: `[ABC-123]` "A ticket in any system: use its key, like `[SUP-45]`", `[CHAT]` "The ask came in a chat, no ticket yet", `[EMAIL]` "The ask came by email, no ticket yet", `[OWN]` "Your own work, not for anyone else (no person)", `[MISC]` "Anything else".

Condition blocks: text between `<!-- if:NAME -->` and `<!-- end:NAME -->`, on one line or across lines, stays only when NAME is on; remove the two markers either way, and remove a line that only held a removed block. NAME is one of: `close` (Close to Done on), `noclose` (Close to Done off), `snooze`, `followups`, `tags` (tag format), `plain` (plain titles). Gaps in step numbers after a removed block are fine.

After filling, no `{{`, `<!-- if:` or `<!-- end:` may remain. The follow-up template keeps its `[[...]]` placeholders: the follow-up rule fills them later.

Files, in this order. Record each one as `{ "type": "file", "path": "<path>" }` right after writing it:

1. `config.json`: the shape of `templates/config.example.json`, with this install's `plugin` version, `installedAt`, `modules`, `sections` (role to id) and `sectionNames` for the sections made; `workday` (`start`, `days` as the cron day list, `daysText`, `utcOffsetAtSetup`) with automation; `names` (`format`: "tag" or "plain", `tags`) with Thread names; `tasks` (`model`, and `wakeSweep` and `tidyReport` with `name` and `cron`, for the tasks that will be made) with automation. Leave out the parts that do not apply.
2. `rules.md`: join the filled templates `rules-core.md`, then `rules-sections.md` (Sections), `rules-close.md` (Close to Done), `rules-snooze.md` (Snooze), `rules-followups.md` (Follow-up reminders), `rules-names.md` (Thread names), each only if its module is on.
3. With Snooze: `snooze.json` with exactly `{"version": 1, "snoozed": []}`.
4. With automation: `tasks.json` with exactly `{"version": 1, "tasks": []}`.
5. With Follow-up reminders: `task-followup-wake.md`, the filled `templates/task-followup-wake.md`.
6. The `CLAUDE.md` block. These exact three lines, with an empty line before them:

```
<!-- threadkeeper:start (added by /threadkeeper:setup, removed by /threadkeeper:uninstall) -->
@~/.claude/threadkeeper/rules.md
<!-- threadkeeper:end -->
```

   If `HOME/.claude/CLAUDE.md` exists, append the block at the end with Edit or Write, keeping every existing line exactly as it was. If it does not exist, create it with only the block. Record `{ "type": "claude-md-block", "path": "<path>", "createdFile": <true|false> }`.

## 9. Scheduled tasks (only with automation)

Make the wake sweep (with Snooze) and then the tidy report (with Tidy report). For each task, do all of these steps before the next task:

1. Fill the template (`templates/task-wake-sweep.md` or `templates/task-tidy-report.md`) as in step 8. No `{{`, `<!-- if:` or `<!-- end:` may remain.
2. Call `create_scheduled_task` with:

   | Field | Wake sweep | Tidy report |
   |---|---|---|
   | taskId | `threadkeeper-wake-sweep` | `threadkeeper-tidy-report` |
   | title | `Threadkeeper: wake snoozed threads` | `Threadkeeper: tidy report` |
   | description | `Threadkeeper: wakes snoozed threads when due. Made by /threadkeeper:setup; /threadkeeper:uninstall removes it.` | `Threadkeeper: read-only list of idle, duplicate and old threads. Made by /threadkeeper:setup; /threadkeeper:uninstall removes it.` |
   | cronExpression | the sweep cron from step 3c | the tidy cron from step 3c |
   | prompt | the filled template | the filled template |
   | notifyOnCompletion | false | false |

   If the call is refused, or the tool used another task id than the one asked for: stop (hard rules). Note what the result says about the permission mode the task was saved in.
3. At once, record it. In the install record: `{ "type": "task", "name": "<task id>", "purpose": "wake-sweep" | "tidy-report", "cron": "<cron>", "model": "claude-sonnet-5-5", "modelSet": false, "savedMode": "<what the result said, or unknown>" }`. In `tasks.json`: `{ "name": "<task id>", "purpose": "wake-sweep" | "tidy-report", "created": "<now>", "model": "claude-sonnet-5-5", "cron": "<cron>" }`.
4. Set the model. The scheduled-tasks tool has no model field. The app reads a `model:` line in the frontmatter of the task's own `SKILL.md` when the task fires on its schedule:
   1. Call `list_scheduled_tasks` and find the task. If it is missing, or it has `notRead`: stop (hard rules).
   2. Read the file at its `path`. It must start with a frontmatter block: a `---` line, lines like `name:` and `description:`, and a second `---` line. If not: stop (hard rules).
   3. With Edit, add the line `model: claude-sonnet-5-5` directly before the second `---` line. If a `model:` line is already there, change that line instead. Change nothing else in the file.
   4. Read the file again. The frontmatter must still open and close with `---` and hold exactly one `model: claude-sonnet-5-5` line. If not: stop (hard rules).
   5. In the install record, set `"modelSet": true` and add `"path": "<the task's SKILL.md path>"`.
5. Check: in `list_scheduled_tasks` the task is enabled and its next run is the time you expect. If not: stop (hard rules).

Set `completedAt` in the install record.

## 10. Check and hand over

1. Run /threadkeeper:doctor (follow its skill). In this thread "Rules loaded" is expected to say WARN (`CLAUDE.md` is read when a thread starts), and the run checks say "Not run yet" with the first run time.
2. Tell the user, in short lines:
   - What is set up (modules, section names, and with automation: the tasks, their times and the model Sonnet 5.5).
   - The rules work in threads started from now on. Existing threads keep their place.
   - Things to try, only for the modules that are on: start a new thread and see it land in Active; watch the icons change as Claude works; say "close this" in a finished thread; say "snooze until tomorrow 10:00"; ask Claude to "check back on this on Monday at 10:00"; read the first tidy report under Scheduled in the sidebar and reply there, for example "close 2".
   - With automation: tasks run only while the app is open and the computer is awake; a missed run happens at the next chance. If a run stops to ask for permission (to move or rename a thread), open that run under Scheduled and allow it. Open each Threadkeeper task under Scheduled and check the task editor shows Sonnet 5.5. If it shows another model, pick Sonnet 5.5 and save.
   - /threadkeeper:doctor checks it any time; /threadkeeper:uninstall removes it.
3. If Sections is on, ask with AskUserQuestion: "Move this thread to <Active name> too?" with "Yes" and "No, leave it". On yes, move only this thread (`session_ids: ["self"]`).
