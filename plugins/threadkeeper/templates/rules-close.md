
## Close to Done

Finished threads go to the sidebar section "{{DONE_NAME}}" (section id `{{DONE_ID}}`). The mod then shows ✅ on them.

- Closing: when the user says this thread's work is done ("close this", "close it", "mark this done" or similar), move this thread to "{{DONE_NAME}}" with move_sessions (session_ids ["self"], section_id "{{DONE_ID}}") and say so in one line.
- Offer: when a turn ends, the work looks finished and no other question is waiting, ask "Close this thread?" with the answers "Yes, close it" and "Not yet". Use the app's end-of-turn question box if there is one; otherwise ask in one line at the end of the reply.
- Reopening: when new work arrives in a thread that is in "{{DONE_NAME}}", first move it back to "{{ACTIVE_NAME}}" (section id `{{ACTIVE_ID}}`) and say so in one line.
- Never close, archive or delete any other thread unless the user asks.
