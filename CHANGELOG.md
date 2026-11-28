# Changelog

## 0.6.2-team.1 (pilot)

Fixes from the full try-out on a real desktop install.

- Mod: leaves a ⏰ or ✅ alone when another tool put it there (the thread is outside Threadkeeper's sections and, for ⏰, not in its snooze list). Before, it replaced them, which clashed with a snooze or done system the user already had.
- Mod: when the app reopens a thread, a snoozed title keeps its wake time. Before, `⏰ 11-23 Mon 09` could lose the date until the next turn ended.
- Snooze and follow-up rules: a snooze turn asks nothing and offers nothing, because any reply wakes the thread. When the wake time is between wake-up runs, Claude says when the thread really comes back, and that "remind me at <time>" gives an exact time.
- Wake-up run: step numbers fixed, and the heartbeat uses the time read at the start of the run.
- Setup: the closing text asks you to check the task editor shows Sonnet 5.5. Tested: the editor's model and the task's model line are the same setting.
- README: honest wording on running Threadkeeper next to another snooze system (use one, not two).

## 0.6.1-team.1 (pilot)

Fixes from the first real desktop install.

- Wake-up run: only clears ⏰ from threads Threadkeeper snoozed (listed in its snooze list). Before, it cleared ⏰ from every thread outside its Snoozed section, which clashed with a snooze system the user already had.
- Uninstall: the recommended title clean-up removes ✅ only from threads in Threadkeeper's Done section and ⏰ only from its snoozed threads. A ✅ or ⏰ from another tool stays.
- Setup: if the app's Auto mode holds back a step (for example creating a scheduled task), setup asks whether to try once more instead of stopping halfway.
- README and INSTALL.md: pick Auto mode before typing `/threadkeeper:setup`.

## 0.6.0-team.1 (pilot)

The full version: four more modules.

- Snooze: "snooze until Tue 10:00" moves the thread to a Snoozed section with ⏰ and the wake time. A scheduled wake-up run (working days, 3 times a day) brings it back to Active with a blue dot. Writing in a snoozed thread wakes it at once. Threads dragged into Snoozed by hand get a wake time.
- Follow-up reminders: when Claude promises to check back at a time, it snoozes the thread and makes a one-off task that wakes it then.
- Thread names: Claude names new threads in your format (`[TAG] Person: short title` or plain). Never renames a title you typed.
- Tidy report: a read-only daily list of idle, duplicate and old threads. Nothing changes until you reply with the items you want closed or archived. It never deletes a thread.
- Setup asks two questions (Basics, Automation), plus start time, working days and name format. Every scheduled task gets an explicit model (Sonnet 5.5). Setup checks the thread's permission mode first: tasks made outside Auto mode stop and ask before they move a thread.
- Doctor: 16 checks, including the snooze list, each task and its model, and the wake-up and tidy report runs.
- Uninstall deletes Threadkeeper's tasks first, and can move snoozed threads back and clean wake times from titles.

Not in this version: context saver, watchdog.

## 0.5.0-team.1 (pilot)

First version for other people. Built from the personal edition (0.4.5), made general:

- Status icons: ⏳ working, ❓ waiting on you, 🟢 reply ready, ⚠️ error, ✅ done.
- Sections module: Active section, new threads filed there on their first turn.
- Close to Done module: "close this" moves a thread to Done; Claude offers to close finished work.
- `/threadkeeper:setup`: asks for modules and section names, shows every change, backs up, records every change.
- `/threadkeeper:doctor`: read-only checks with a fix per problem. No scripts, so the same on macOS and Windows.
- `/threadkeeper:uninstall`: removes exactly what setup recorded; optionally cleans icons from titles.
- Files in `~/.claude/threadkeeper/`. Paths from `USERPROFILE` or `HOME`.
- The mod stays quiet outside the desktop app (terminal, IDE, `claude -p`).

Not in this version: snooze, follow-up reminders, thread names, tidy report, context saver, watchdog.
