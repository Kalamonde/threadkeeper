
## Follow-up reminders

A follow-up wakes this thread at a set time with a one-off scheduled task. Every task Threadkeeper creates is listed in `{{TK_DIR}}/tasks.json`.

### When

When you promise to check back at a later time ("I will check again tomorrow at 10:00"), or the user asks you to remind them or to check back at a time ("remind me on Monday", "look at this again Thursday afternoon"). Do not set one for a vague "later": ask for a time, or offer to snooze instead.

### Steps

1. Snooze this thread until that time, as in the Snooze rules (same time rules: not before {{START_TIME}}, at most 14 days), with `"by": "follow-up"` and the promise in a few words as the reason.
2. Make the task text: Read `{{TK_DIR}}/task-followup-wake.md`. Replace `[[SESSION_ID]]`, `[[BARE_TITLE]]`, `[[WAKE_AT]]` and `[[REASON]]` with this thread's values. No `[[` may remain.
3. Load `mcp__scheduled-tasks__create_scheduled_task` and `mcp__scheduled-tasks__list_scheduled_tasks` with ToolSearch. Call create_scheduled_task with:
   - taskId: `threadkeeper-followup-<YYYYMMDD-HHMM of wake_at>-<first 8 letters and digits of the session id, after any "local_">`, in lower case
   - title: `Threadkeeper: wake <bare title, at most 40 characters>`
   - description: `Threadkeeper follow-up: wakes one thread at <wake_at>. Made by Threadkeeper. /threadkeeper:uninstall removes it.`
   - fireAt: the wake_at
   - notifyOnCompletion: false
   - prompt: the task text from step 2
4. At once, add the task to `{{TK_DIR}}/tasks.json` (start from `{"version": 1, "tasks": []}` if it is missing): `{"name": "<taskId the tool used>", "purpose": "follow-up", "created": "<now>", "model": "{{TASK_MODEL}}", "fireAt": "<wake_at>", "session_id": "<this session id>"}`. Keep the other entries.
5. Set the task's model: call list_scheduled_tasks, find the task, Read the file at its `path`. In the frontmatter (between the first two `---` lines), add the line `model: {{TASK_MODEL}}` just before the second `---`. If a `model:` line is already there, change it to `model: {{TASK_MODEL}}`. Read the file again and check the line is there and the frontmatter still opens and closes with `---`.
6. Say in one line: "I will check back <Ddd D Mmm HH:MM>: this thread is snoozed until then, and a one-off task wakes it with a blue dot." Then end the turn: ask nothing and offer nothing, because any reply wakes the thread.

If any step fails or a tool refuses: stop, say which step failed in one line, and suggest /threadkeeper:doctor. Do not try another way.

### After the wake-up

The task only wakes the thread (back to "{{ACTIVE_NAME}}", blue dot, ⏰ gone). It sends no message. When the user next writes in this thread, start with the promised check.

### Cancel

When the user cancels a follow-up for this thread: wake the thread (Snooze rules, "Wake on write"), then delete the task with `mcp__scheduled-tasks__delete_scheduled_task` (only a task in tasks.json with this session_id and a fireAt still ahead) and remove it from tasks.json. If the user writes in the thread before the follow-up time without cancelling, the thread wakes as usual and the task later finds it awake and does nothing.

### Limits

- Create, change or delete only follow-up tasks for this thread, and only as above. Never touch a task that is not in tasks.json.
- A task is saved in this thread's permission mode (`permissionMode` in get_session "self"). If it is not `auto` or `bypassPermissions`, add to the step 6 line: "The wake-up run will wait for you to allow it under Scheduled."
