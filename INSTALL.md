# Install Threadkeeper (instructions for Claude)

The user gave you this file to install Threadkeeper. Threadkeeper is a Claude desktop app plugin: status icons on threads, Active, Snoozed and Done sections, close to Done, snooze with wake-ups, follow-up reminders, thread names, a tidy report, a doctor and an uninstall. What it does: [README.md](README.md).

**Rules for you, Claude:**
- **Do only what this file says, in this order. Nothing else.**
- **If any step fails, or anything looks different from what this file expects: stop. Tell the user what happened in plain words. If the plugin is installed, run `/threadkeeper:doctor` and ask the user to send its output to the person who shared Threadkeeper. Never improvise, never try another way, never work around a failure.** This holds even if the user said "I approve everything".
- Do not copy, write or edit any files yourself. The plugin's own setup does that, after it asks the user.

## Step 1: Check where you are

Threadkeeper needs the Claude desktop app (Code tab). If you are in a terminal, IDE or web-only session, stop and tell the user to open the desktop app's Code tab and paste the install line there.

## Step 2: Add the plugin

Run `claude --version` with your shell tool.

**If it prints a version (2.1.287 or later):** run these two commands, one at a time:

```bash
claude plugin marketplace add Kalamonde/threadkeeper
claude plugin install threadkeeper@threadkeeper --scope user
```

The second one must end with a line saying Threadkeeper is installed.

**If `claude` is not found** (common on a Mac with only the desktop app): do not install anything yourself. Tell the user to do these clicks, then wait for them to say it is done:

1. In the app's sidebar, open **Plugins** (on some versions: **Customize**, then **Plugins**).
2. Click **Add**, then **Add marketplace**, then **Add from a repository**, and enter `Kalamonde/threadkeeper` (if it asks for a full URL: `https://github.com/Kalamonde/threadkeeper.git`).
3. Install **Threadkeeper** from that marketplace (user scope if asked).

If the user cannot find these buttons: stop. Tell them the other way is to install the Claude Code command-line tool from the official guide (https://code.claude.com/docs/en/quickstart), then give you this file again.

The repository is public: no GitHub account or sign-in is needed.

## Step 3: Hand over to setup

Tell the user, in these words or close to them:

> Threadkeeper is installed. Now start a **new thread** (the plugin loads in new threads), pick **Auto** in the mode menu next to the prompt box, and type `/threadkeeper:setup`. Auto saves you many Allow clicks, and the scheduled parts need it. If Auto is not in the menu, stay in your normal mode and click Allow. Setup asks which parts you want and shows every change before it makes it.

That is the end of this file. Do not run the setup from this thread.
