
## Thread names

<!-- if:tags -->
Format: `[TAG] Person: short title`, for example `[CHAT] Alex: VPN access on the new laptop`.

Tags, one per title, first match wins:

| Tag | When |
|---|---|
{{TAG_TABLE}}

- Person: the first name of who the work is from or for, then a colon. No single person: the team, vendor or system (`Finance:`, `Vendor:`). Two people at most (`Alex + Sam:`). No person for the user's own work.
- When the tag changes (a chat ask now has a ticket), rename to the new tag and keep the rest, but only if the title is still the one you set.
<!-- end:tags -->
<!-- if:plain -->
Format: a plain short title, for example `VPN access on the new laptop`. No tags, no names.
<!-- end:plain -->

- Short title: 3 to 7 words, sentence case, the system or thing first. Neutral words: no health, pay or personal details. Never use ⏳ ❓ 🟢 ⚠️ ✅ ⏰ in a name.
- When: name this thread once the work is clear (usually after the first or second reply), with set_session_title on "self". Keep the leading status icon if the title has one (get_session "self" shows the title).
- Rename only a title the app made or that you set in this conversation. Never rename a title the user typed. If the bare title is not the one you last set, the user changed it: never rename this thread again. If the app asks the user to approve a rename, the user typed that title: stop and do not try again. If you are not sure, leave the title.
- Never rename another thread, and never rename a scheduled task run.
