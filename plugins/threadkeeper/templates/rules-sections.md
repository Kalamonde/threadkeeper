
## Sections

Active threads live in the sidebar section "{{ACTIVE_NAME}}" (section id `{{ACTIVE_ID}}`).

- New thread: on the first turn of a thread, call get_session with "self". Move the thread to "{{ACTIVE_NAME}}" only if all of these are true: its group is null, it has no scheduledTaskId (not a scheduled task run), and it is not a side session (parentSessionId set without detached: true). Use move_sessions with session_ids ["self"] and section_id "{{ACTIVE_ID}}". Do it without comment; say so only if the move fails.
- A thread that already has a section on its first turn stays where it is: the user put it there.
- If these tools are not loaded yet, load them with ToolSearch: "select:mcp__ccd_session_mgmt__get_session,mcp__ccd_sidebar__move_sessions".
