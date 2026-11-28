import type { EngineInterface, McpToolResult, Register, RenderElement } from 'claude-code'

// Threadkeeper: one status icon in front of each thread's own sidebar title.
//   ⏳ working, also while a subagent still runs after the turn
//   ❓ waiting on you: a question, plan approval, or the turn ended on a
//      question Claude cannot continue without
//   🟢 reply ready, not looked at yet (goes when the thread is on screen)
//   ⚠️ stopped on an error
//   ✅ in the Done section (only with the "close" module)
//   ⏰ in the Snoozed section, with the wake time (only with the "snooze" module)
// A ⏰ or ✅ from another tool, on a thread outside Threadkeeper's sections, stays.
// It reads sections but never moves a thread: moves stay with Claude's
// written rules (~/.claude/threadkeeper/rules.md, made by /threadkeeper:setup).
// Once per session it checks its own footing and writes a health file that
// /threadkeeper:doctor reads.
const VERSION = '0.6.2-team.1'
const ICON = {
  working: '⏳ ',
  waiting: '❓ ',
  ready: '🟢 ',
  error: '⚠️ ',
  done: '✅ ',
  snoozed: '⏰ ',
} as const
const ICONS: readonly string[] = Object.values(ICON)
const SESSIONS = 'ccd_session_mgmt'
const SIDEBAR = 'ccd_sidebar'
const WRAP_UP = 'mcp__ccd_turn__wrap_up'
const ACTIVE_AGENT = ['pending', 'running', 'waiting']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// The wake time after ⏰: `11-05 Thu 09 `.
const WAKE_TAG = /^\d{2}-\d{2} (?:Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d{2} /
// Held by the host, so an update applied mid-turn does not lose a blocking question.
const BLOCKED = { plugin: 'threadkeeper', key: 'blocked' } as const

// Title changes run one after another, so the end of a short turn never
// overtakes its own start.
let queue: Promise<void> = Promise.resolve()
let hasLoggedError = false
// The title shows 🟢: the next time the thread is on screen, it goes.
let isUnread = false
let isChecked = false
let hasToasted = false
// Only the desktop app has the session and sidebar tools the mod needs.
let isDesktop = true
let problems: string[] = []
let selfFound: string[] = []
let config: Config | undefined
// session id -> wake_at, from ~/.claude/threadkeeper/snooze.json (snooze module).
// Claude writes it (snooze rules) and so does the wake sweep task; the mod only reads it.
let snoozes: Record<string, string> = {}

// From ~/.claude/threadkeeper/config.json, written by /threadkeeper:setup.
// Section ids, not names: a renamed section still matches.
type Config = {
  modules: Record<string, boolean>
  sections: Record<string, string>
}
type Thread = {
  id?: string
  title?: string
  sectionId?: string
  isRoutine: boolean
  hasSection: boolean
}
// Picks the icon from the thread and the icon it shows now ('' for none).
// null leaves the title exactly as it is.
type Choose = (thread: Thread, current: string) => string | null

function leadingIcon(title: string): string {
  return ICONS.find(icon => title.startsWith(icon)) ?? ''
}

function strip(title: string): string {
  let rest = title
  for (let icon = leadingIcon(rest); icon; icon = leadingIcon(rest)) {
    rest = rest.slice(icon.length)
    if (icon === ICON.snoozed) rest = rest.replace(WAKE_TAG, '')
  }
  return rest
}

// `2026-11-05T09:00:00+01:00` -> `11-05 Thu 09 `: the wall-clock values as
// stored (the user's own time zone, written by the snooze rules), so no sums.
function wakeTag(wakeAt: string | undefined): string {
  const parts = wakeAt?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/)
  if (!parts) return ''
  const [, year, month, day, hour] = parts
  const weekday = DAYS[new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay()]
  return `${month}-${day} ${weekday} ${hour} `
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function flags(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === 'boolean')) as Record<string, boolean>
}

function strings(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === 'string' && v)) as Record<string, string>
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function textOf(result: McpToolResult): string {
  return result.content.map(block => block.text ?? '').join(' ')
}

// The section id a module uses, or undefined when that module is off.
function sectionOf(module: string, section: string): string | undefined {
  return config?.modules[module] ? config.sections[section] : undefined
}

function sectionIcon(thread: Thread): string | undefined {
  if (!thread.sectionId) return undefined
  if (thread.sectionId === sectionOf('close', 'done')) return ICON.done
  if (thread.sectionId === sectionOf('snooze', 'snoozed')) {
    return ICON.snoozed + wakeTag(thread.id ? snoozes[thread.id] : undefined)
  }
  return undefined
}

// A ⏰ or ✅ that another tool put there (for example a snooze or done system
// the user already had): the thread is outside Threadkeeper's own sections and,
// for ⏰, not in its snooze list. The mod leaves such a title alone.
function isForeign(thread: Thread): boolean {
  const icon = leadingIcon(thread.title ?? '')
  if (icon !== ICON.done && icon !== ICON.snoozed) return false
  if (thread.sectionId && Object.values(config?.sections ?? {}).includes(thread.sectionId)) return false
  return !(icon === ICON.snoozed && thread.id && snoozes[thread.id])
}

function endIcon(reason: string, blocked: boolean, hasAgents: boolean): string {
  if (hasAgents) return ICON.working
  if (reason === 'aborted') return ''
  if (reason === 'error' || reason === 'refusal') return ICON.error
  return blocked ? ICON.waiting : ICON.ready
}

// ~/.claude/threadkeeper/<name>, on Windows and macOS alike.
async function ownFile($: EngineInterface, name: string): Promise<string | undefined> {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  return home ? `${home.replace(/\\/g, '/')}/.claude/threadkeeper/${name}` : undefined
}

async function readJson($: EngineInterface, name: string): Promise<Record<string, unknown> | undefined> {
  try {
    const path = await ownFile($, name)
    if (!path) return undefined
    return JSON.parse(await $.fs.read(path)) as Record<string, unknown>
  } catch {
    return undefined
  }
}

// No config.json: setup has not run yet. Icons still work; nothing to check.
async function loadConfig($: EngineInterface): Promise<Config | undefined> {
  const raw = await readJson($, 'config.json')
  if (!raw) return undefined
  return { modules: flags(raw.modules), sections: strings(raw.sections) }
}

async function loadSnoozes($: EngineInterface): Promise<Record<string, string>> {
  if (!config?.modules.snooze) return {}
  const list = (await readJson($, 'snooze.json'))?.snoozed
  const entries = Array.isArray(list) ? (list as { session_id?: unknown; wake_at?: unknown }[]) : []
  const found: Record<string, string> = {}
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const id = text(entry.session_id)
    const wakeAt = text(entry.wake_at)
    if (id && wakeAt) found[id] = wakeAt
  }
  return found
}

// Merges into ~/.claude/threadkeeper/health.json; never fails the hook.
async function writeHealth($: EngineInterface, patch: Record<string, unknown>): Promise<void> {
  try {
    const path = await ownFile($, 'health.json')
    if (!path) return
    let current: Record<string, unknown> = {}
    try {
      current = JSON.parse(await $.fs.read(path)) as Record<string, unknown>
    } catch {}
    await $.fs.write(path, JSON.stringify({ ...current, ...patch, version: VERSION }, null, 2))
  } catch {}
}

async function readThread($: EngineInterface): Promise<Thread> {
  const result = await $.mcp.call(SESSIONS, 'get_session', { session_id: 'self' })
  if (result.isError) throw new Error(textOf(result))
  const raw = JSON.parse(textOf(result)) as Record<string, unknown>
  const group = raw.group as { id?: unknown } | null | undefined
  return {
    id: text(raw.sessionId),
    title: text(raw.title),
    sectionId: text(group?.id),
    isRoutine: raw.scheduledTaskId != null,
    hasSection: 'group' in raw,
  }
}

async function setIcon($: EngineInterface, choose: Choose): Promise<void> {
  try {
    const thread = await readThread($)
    // Scheduled task runs never get an icon.
    if (!thread.title || thread.isRoutine) return
    if (isForeign(thread)) {
      isUnread = false
      return
    }
    const icon = choose(thread, leadingIcon(thread.title))
    if (icon === null) {
      isUnread = leadingIcon(thread.title) === ICON.ready
      return
    }
    const next = icon + strip(thread.title)
    isUnread = leadingIcon(next) === ICON.ready
    if (next === thread.title) return
    const result = await $.mcp.call(SESSIONS, 'set_session_title', { session_id: 'self', title: next })
    if (result.isError) throw new Error(textOf(result))
  } catch (error) {
    // Outside the desktop app the session tools are missing: one line in the
    // debug log. Real breakage in the app shows up in the self-check.
    if (hasLoggedError) return
    hasLoggedError = true
    $.ui.log(`${$.plugin.name}: title not changed (${message(error)})`, { to: 'debug' })
  }
}

function retitle($: EngineInterface, choose: Choose): Promise<void> {
  if (!isDesktop) return Promise.resolve()
  queue = queue.then(() => setIcon($, choose))
  return queue
}

// Only 🟢 goes on a look: ❓ and ⚠️ still need the user to act.
function markRead($: EngineInterface): Promise<void> {
  return isUnread ? retitle($, (_, current) => (current === ICON.ready ? '' : null)) : Promise.resolve()
}

// Terminal, VS Code and `claude -p` sessions have no app session tools
// (`unlisted`): the mod stays quiet there. Any other refusal means the app's
// tools are there but broken, which the self-check reports.
async function hasAppTools($: EngineInterface): Promise<boolean> {
  try {
    const link = await $.mcp.connect(SESSIONS)
    return link.isConnected || link.reason !== 'unlisted'
  } catch {
    return true
  }
}

async function hasActiveAgents($: EngineInterface): Promise<boolean> {
  return (await $.agent.list()).some(agent => ACTIVE_AGENT.includes(agent.status))
}

// Scheduled runs skip the self-check, but still note the engine version.
async function noteEngine($: EngineInterface): Promise<void> {
  try {
    await writeHealth($, { engine: (await $.session.version()).version, engineSeenAt: new Date().toISOString() })
  } catch {}
}

// Does the app still answer the way the mod needs, and do the sections setup
// made still exist? Run at the first turn of each desktop thread. Results go
// to the health file and, if anything is wrong, to a band and one toast.
async function selfCheck($: EngineInterface): Promise<void> {
  const found: string[] = []
  try {
    const thread = await readThread($)
    if (thread.isRoutine) {
      await noteEngine($)
      return
    }
    if (!thread.title || !thread.hasSection) found.push('the app no longer reports thread titles or sections')
  } catch (error) {
    found.push(`the app's session tools do not answer (${message(error)})`)
  }
  const wanted = Object.entries(config?.sections ?? {})
  if (wanted.length > 0) {
    try {
      const result = await $.mcp.call(SIDEBAR, 'list_sections', {})
      if (result.isError) throw new Error(textOf(result))
      const ids = new Set((JSON.parse(textOf(result)) as { id?: unknown }[]).map(section => String(section.id)))
      for (const [name, id] of wanted) {
        if (!ids.has(id)) found.push(`the ${name} section is gone from the sidebar`)
      }
    } catch (error) {
      found.push(`the sidebar sections cannot be read (${message(error)})`)
    }
  }
  selfFound = found
  await writeHealth($, {
    checkedAt: new Date().toISOString(),
    engine: (await $.session.version()).version,
    problems: found,
  })
}

function refreshProblems($: EngineInterface): void {
  problems = selfFound
  if (problems.length > 0 && !hasToasted) {
    hasToasted = true
    $.ui.toast(`Threadkeeper needs attention: ${problems[0]}. Type /threadkeeper:doctor`)
  }
}

export const register: Register = on => {
  // After a crash or app quit mid-turn the title still says ⏳: show the section icon, or nothing.
  // Any other title stays as it is, wake time included.
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    config = await loadConfig($)
    snoozes = await loadSnoozes($)
    await retitle($, (thread, current) => (current === ICON.working ? sectionIcon(thread) ?? '' : null))
    return result
  })

  on('turn.start', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    config = (await loadConfig($)) ?? config
    if (!isChecked) {
      isChecked = true
      isDesktop = await hasAppTools($)
      if (isDesktop) await selfCheck($)
    }
    if (!isDesktop) return result
    await $.state.set(BLOCKED, false)
    refreshProblems($)
    // Skip a new thread's first turn start, so the app still names it.
    if ((await $.session.turns()) > 1) await retitle($, () => ICON.working)
    return result
  })

  // A question or plan approval waits on the user: ❓ until it is answered.
  // Each tool hook carries a .catch: a Threadkeeper fault never holds up a tool.
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    await retitle($, () => ICON.waiting)
    const result = await next(e)
    await retitle($, () => ICON.working)
    return result
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  on('tool.call', { tool: 'ExitPlanMode' }, async ($, e, next) => {
    await retitle($, () => ICON.waiting)
    const result = await next(e)
    await retitle($, () => ICON.working)
    return result
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  on('tool.call', async ($, e, next) => {
    if (e.tool === WRAP_UP) await $.state.set(BLOCKED, (e as { blocked?: unknown }).blocked === true)
    return next(e)
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  // The desktop asks for the band above the prompt only for the thread on
  // screen, so a draw means the user is looking at it.
  // The same band carries the self-check's warning.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (isUnread && !e.props.isWorking) await markRead($)
    if (problems.length === 0) return next(e)
    const { Text } = $.ui.resolve(e)
    return h(Text, { color: 'yellow' }, `Threadkeeper needs attention: ${problems[0]}. Type /threadkeeper:doctor`) as RenderElement
  })

  // A window or phone opened the thread.
  on('session.attach', async ($, e, next) => {
    const result = await next(e)
    await markRead($)
    return result
  })

  // Section first (✅, ⏰), then the reply state. Never restores an old title,
  // so a rename Claude made during the turn survives.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || !isDesktop) return result
    const blocked = (await $.state.get(BLOCKED)).value === true
    const icon = endIcon(e.reason, blocked, await hasActiveAgents($))
    // Setup or a snooze may have changed the files during this turn.
    config = (await loadConfig($)) ?? config
    snoozes = await loadSnoozes($)
    await retitle($, thread => sectionIcon(thread) ?? icon)
    await writeHealth($, { lastTurnAt: new Date().toISOString() })
    return result
  })
}
