
## Snooze

Snoozed threads live in the sidebar section "{{SNOOZED_NAME}}" (section id `{{SNOOZED_ID}}`). Awake threads go back to "{{ACTIVE_NAME}}" (section id `{{ACTIVE_ID}}`). The list of snoozed threads is `{{TK_DIR}}/snooze.json`. The user works {{WORK_DAYS_TEXT}} and starts at {{START_TIME}}, in the computer's local time.

### Times

- Every time in snooze.json is the user's local time with the UTC offset of that date, in ISO 8601: `2026-11-23T09:00:00+01:00`.
- Get the local time now with the shell: `date +%Y-%m-%dT%H:%M:%S%z` (macOS, Linux, Git Bash), or `Get-Date -Format o` (PowerShell). `%z` gives `+0100`: write it as `+01:00`.
- The offset of a later date can differ (summer time). Get it for that date and time: macOS `date -j -f "%Y-%m-%d %H:%M" "2026-11-23 09:00" +%z`, Linux or Git Bash `date -d "2026-11-23 09:00" +%z`, PowerShell `(Get-Date "2026-11-23 09:00").ToString("zzz")`.

### Wake time

- "snooze" with no time: the next working day at {{START_TIME}}.
- A time the user gives ("until Tuesday 14:00", "for 2 hours", "until tomorrow"): use it. A day with no time: {{START_TIME}} that day.
- Never before {{START_TIME}}: an earlier time becomes {{START_TIME}} on the same day. Say so in the reply.
- At most 14 days from now: a later date becomes 14 days from now at {{START_TIME}}. Say so in the reply.
- A day that is not a working day is allowed, but the wake-up task runs on working days only, so the thread wakes at the first run after that time. Say so once.

### Snooze this thread

When the user says "snooze", "snooze until <time>", "park this until <time>" or similar:

1. Work out wake_at (rules above).
2. Call get_session with "self". Note its sessionId and its bare title.
3. Read snooze.json. If it is missing, start from `{"version": 1, "snoozed": []}`. Remove any entry with this session_id. Add one entry: `{"session_id": "<sessionId>", "title": "<bare title>", "wake_at": "<wake_at>", "reason": "<a few words>", "snoozed_at": "<now>", "by": "rule"}`. Keep every other entry exactly as it was. Write the file back as valid JSON.
4. Move this thread with move_sessions: session_ids ["self"], section_id "{{SNOOZED_ID}}".
5. Say in one line: "Snoozed until <Ddd D Mmm HH:MM>: <reason>." The mod adds ⏰ and the wake time to the title when the turn ends: do not set it yourself.
6. End the turn there. Ask nothing and offer nothing: no question, no answer buttons, no "want me to...?". Any reply is a write, and a write wakes the thread at once. If wake_at is not at a wake-up run time ({{SWEEP_TIMES_TEXT}} on working days), add one line: "It comes back at the first wake-up run after that: <Ddd HH:MM>."<!-- if:followups --> Then: "For an exact time, say: remind me at <time>."<!-- end:followups -->

"Snooze until <other time>" in a thread that is already snoozed: change its entry's wake_at and reason the same way.

### Offer to snooze

When a turn ends, this thread now waits on a person, a reply, a date or a later check, and no other question is waiting: ask "Snooze until <Ddd HH:MM>?" with the answers "Yes, snooze" and "Not now". Pick the time the wait is likely to end, else the next working day at {{START_TIME}}. Use the app's end-of-turn question box if there is one; otherwise ask in one line at the end of the reply. Ask at most once per turn, and never in a scheduled task run.

### Wake on write

When the user writes in this thread (their own message, not a task notice and not a message from another thread), and this thread was snoozed in this conversation and not woken since:

1. Before anything else, move it with move_sessions: session_ids ["self"], section_id "{{ACTIVE_ID}}".
2. Remove its entry (this session_id) from snooze.json. Keep the other entries.
3. Say in one line: "Woke this thread (it was snoozed until <Ddd HH:MM>)." Then answer the message.

If you are not sure whether this thread is still snoozed, call get_session with "self" and compare its group id with `{{SNOOZED_ID}}`. "Wake this", "unsnooze" or "cancel the snooze" do the same. The mod removes ⏰ from the title when the turn ends.

### Limits

- Snooze or wake only this thread, unless the user asks for another thread by name.
- The wake-up task "Threadkeeper: wake snoozed threads" wakes due threads on working days at its set times. It also gives threads the user drags into "{{SNOOZED_NAME}}" by hand a wake time (the next working day at {{START_TIME}}).
- Scheduled tasks run only while the Claude app is open and the computer is awake. A wake-up that is due runs at the next chance. Say this when the user asks why a thread did not wake on time.
