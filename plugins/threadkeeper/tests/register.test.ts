import { expect, test } from 'claude-code/testing'

// Each test stands in for the desktop app and the machine: get_session answers
// the thread, set_session_title records each title, list_sections lists the
// sidebar, and a small in-memory file system holds config.json, snooze.json and
// the health file. Files are keyed from `.claude` on, so the same tests hold
// for a Windows (USERPROFILE) and a macOS (HOME) home folder.
const IDS = { active: 'sec-active', done: 'sec-done', snoozed: 'sec-snoozed', other: 'sec-other' }
const key = (path: string) => path.replace(/\//g, '\\').replace(/^.*?\\\.claude\\/, '.claude\\')
const CONFIG_FILE = key('/.claude/threadkeeper/config.json')
const HEALTH_FILE = key('/.claude/threadkeeper/health.json')
const SNOOZE_FILE = key('/.claude/threadkeeper/snooze.json')
const ALL_MODULES = { core: true, sections: true, close: true, snooze: true }
const config = (modules: Record<string, boolean> = ALL_MODULES) =>
  JSON.stringify({
    version: 1,
    modules,
    sections: { active: IDS.active, done: IDS.done, snoozed: IDS.snoozed },
  })

type Fake = {
  id: string
  title: string
  section: string | null
  turns: number
  agents: string[]
  routine?: boolean
  connect: { isConnected: true; server: string } | { isConnected: false; reason: string; message: string }
  env: Record<string, string>
  sidebar: string[]
  files: Record<string, string>
  reads: string[]
  titles: string[]
}

function thread(title: string, section: string | null = IDS.active, turns = 2, agents: string[] = []): Fake {
  return {
    id: 'thread-me',
    title,
    section,
    turns,
    agents,
    connect: { isConnected: true, server: 'ccd_session_mgmt' },
    env: { USERPROFILE: 'C:/Users/t' },
    sidebar: Object.values(IDS),
    files: { [CONFIG_FILE]: config() },
    reads: [],
    titles: [],
  }
}

function engine(on: any, fake: Fake): void {
  const state: Record<string, unknown> = {}
  on('mcp.connect', () => ({ value: fake.connect }))
  on('mcp.call', (_: unknown, e: { tool: string; args: { title?: unknown } }) => {
    const ok = (text: string) => ({ value: { isError: false, content: [{ type: 'text', text }] } })
    if (!fake.connect.isConnected) throw new Error('server not connected')
    if (e.tool === 'get_session') {
      const group = fake.section ? { id: fake.section, name: 'Any name' } : null
      const scheduled = fake.routine ? { scheduledTaskId: 'task-1' } : {}
      return ok(JSON.stringify({ sessionId: fake.id, title: fake.title, group, ...scheduled }))
    }
    if (e.tool === 'list_sections') return ok(JSON.stringify(fake.sidebar.map(id => ({ id }))))
    fake.title = String(e.args.title)
    fake.titles.push(fake.title)
    return ok('ok')
  })
  on('env.get', (_: unknown, e: { name: string }) => ({ value: fake.env[e.name] }))
  on('fs.read', (_: unknown, e: { path: string }) => {
    fake.reads.push(e.path)
    const path = key(e.path)
    if (!(path in fake.files)) throw new Error(`ENOENT ${path}`)
    return { value: fake.files[path] }
  })
  on('fs.write', (_: unknown, e: { path: string; text: string }) => {
    fake.files[key(e.path)] = e.text
    return { value: undefined }
  })
  const keyOf = (e: any) => String(e.key ?? e.ref?.key)
  on('state.get', (_: unknown, e: any) => ({ value: { value: state[keyOf(e)], version: 1 } }))
  on('state.set', (_: unknown, e: any) => {
    state[keyOf(e)] = e.value
    return { value: { isSet: true, version: 1 } }
  })
  on('session.turns', () => ({ value: fake.turns }))
  on('session.version', () => ({ value: { version: '2.1.325' } }))
  on('agent.list', () => ({
    value: fake.agents.map((status, i) => ({ id: `a${i}`, description: 'x', type: 'general-purpose', status })),
  }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('turn.start', (_: unknown, e: { turnId: string }) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', () => ({ result: {} }))
  on('ui.toast', () => ({ value: undefined }))
  // Stands for the app drawing the band when the mod passes.
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return h(Text, null, 'engine')
  })
}

const START = { text: 'hi', turnId: 't1' }
const end = (reason: string) => ({ answer: '', durationMs: 1, isAborted: reason === 'aborted', turnId: 't1', reason }) as any
const BAND = (isWorking: boolean) =>
  ({
    plugin: 'threadkeeper',
    component: 'AbovePrompt',
    requestId: 'band',
    surface: 'desktop',
    props: { hasSurvey: false, isWorking, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  }) as any

async function turn($: any, reason = 'answer'): Promise<void> {
  await $.turn.start(START)
  await $.turn.complete(end(reason))
}

async function bandText($: any): Promise<string> {
  const band = await $.ui.mount(BAND(false))
  const found = (await band.find({ type: 'Text' }))?.text ?? ''
  await band.unmount()
  return found
}

test('a normal turn: ⏳ while working, 🟢 when the reply is ready', async ($, on) => {
  const fake = thread('Thread')
  engine(on, fake)
  await turn($)
  expect(fake.titles).toEqual(['⏳ Thread', '🟢 Thread'])
})

test('🟢 goes once the thread is on screen; not while a turn runs', async ($, on) => {
  const fake = thread('Thread')
  engine(on, fake)
  await turn($)
  const busy = await $.ui.mount(BAND(true))
  await busy.unmount()
  expect(fake.title).toBe('🟢 Thread')
  const seen = await $.ui.mount(BAND(false))
  await seen.unmount()
  expect(fake.title).toBe('Thread')
})

test('a blocking question at turn end shows ❓, and a look leaves it', async ($, on) => {
  const fake = thread('Thread')
  engine(on, fake)
  await $.turn.start(START)
  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'r', ask: 'Go?', blocked: true } as any)
  await $.turn.complete(end('answer'))
  expect(fake.title).toBe('❓ Thread')
  const seen = await $.ui.mount(BAND(false))
  await seen.unmount()
  expect(fake.title).toBe('❓ Thread')
})

test('the next turn clears the blocking flag', async ($, on) => {
  const fake = thread('Thread')
  engine(on, fake)
  await $.turn.start(START)
  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'r', blocked: true } as any)
  await $.turn.complete(end('answer'))
  await turn($)
  expect(fake.title).toBe('🟢 Thread')
})

test('a question pop-up shows ❓ until answered, then ⏳', async ($, on) => {
  const fake = thread('Thread')
  engine(on, fake)
  await $.turn.start(START)
  await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as any)
  await $.turn.complete(end('answer'))
  expect(fake.titles).toEqual(['⏳ Thread', '❓ Thread', '⏳ Thread', '🟢 Thread'])
})

test('an error shows ⚠️, Esc shows nothing', async ($, on) => {
  const fake = thread('Thread')
  engine(on, fake)
  await turn($, 'error')
  expect(fake.title).toBe('⚠️ Thread')
  await turn($, 'aborted')
  expect(fake.title).toBe('Thread')
})

test('Done shows ✅, matched by the section id from config.json', async ($, on) => {
  const fake = thread('Thread', IDS.done)
  engine(on, fake)
  await turn($)
  expect(fake.title).toBe('✅ Thread')
})

test('without the close module, a thread in the Done section gets the normal icons', async ($, on) => {
  const fake = thread('Thread', IDS.done)
  fake.files[CONFIG_FILE] = config({ core: true, sections: true, close: false })
  engine(on, fake)
  await turn($)
  expect(fake.title).toBe('🟢 Thread')
})

test('before setup (no config.json): icons work, no section icons, no band', async ($, on) => {
  const fake = thread('Thread', IDS.done)
  delete fake.files[CONFIG_FILE]
  engine(on, fake)
  await turn($)
  expect(fake.title).toBe('🟢 Thread')
  expect(JSON.parse(fake.files[HEALTH_FILE] ?? '{}').problems).toEqual([])
  expect(await bandText($)).toBe('engine')
})

test('snooze module: ⏰ with the wake time; waking strips it again', async ($, on) => {
  const fake = thread('Thread', IDS.snoozed)
  fake.files[SNOOZE_FILE] = JSON.stringify({ snoozed: [{ session_id: 'thread-me', wake_at: '2026-11-05T09:00:00-08:00' }] })
  engine(on, fake)
  await turn($)
  expect(fake.title).toBe('⏰ 11-05 Thu 09 Thread')
  fake.section = IDS.active
  await turn($)
  expect(fake.titles.slice(-2)).toEqual(['⏳ Thread', '🟢 Thread'])
})

test('a December to January snooze keeps its wall-clock date', async ($, on) => {
  const fake = thread('Thread', IDS.snoozed)
  fake.files[SNOOZE_FILE] = JSON.stringify({ snoozed: [{ session_id: 'thread-me', wake_at: '2027-01-04T10:00:00+00:00' }] })
  engine(on, fake)
  await turn($)
  expect(fake.title).toBe('⏰ 01-04 Mon 10 Thread')
})

test('without the snooze module, the Snoozed section id gives no ⏰', async ($, on) => {
  const fake = thread('Thread', IDS.snoozed)
  fake.files[CONFIG_FILE] = config({ core: true, sections: true, close: true })
  engine(on, fake)
  await turn($)
  expect(fake.title).toBe('🟢 Thread')
})

// The snooze rules write the entry and move the thread during the turn; the
// mod reads ~/.claude/threadkeeper/snooze.json when that turn ends.
const entry = (wakeAt: string, id = 'thread-me') =>
  JSON.stringify({
    version: 1,
    snoozed: [{ session_id: id, title: 'Thread', wake_at: wakeAt, reason: 'waiting on a reply', by: 'rule' }],
  })

test('snoozing during a turn: ⏰ and the wake time from the team snooze.json at turn end', async ($, on) => {
  const fake = thread('Thread')
  engine(on, fake)
  await $.turn.start(START)
  fake.files[SNOOZE_FILE] = entry('2026-11-23T09:00:00+01:00')
  fake.section = IDS.snoozed
  await $.turn.complete(end('answer'))
  expect(fake.titles).toEqual(['⏳ Thread', '⏰ 11-23 Mon 09 Thread'])
})

test('a new wake time replaces the old one in the title', async ($, on) => {
  const fake = thread('⏰ 11-23 Mon 09 Thread', IDS.snoozed)
  fake.files[SNOOZE_FILE] = entry('2026-11-24T14:00:00+01:00')
  engine(on, fake)
  await turn($)
  expect(fake.title).toBe('⏰ 11-24 Tue 14 Thread')
})

test('only the team path counts: a snooze.json in .claude/sidebar is ignored', async ($, on) => {
  const fake = thread('Thread', IDS.snoozed)
  fake.files[key('/.claude/sidebar/snooze.json')] = entry('2026-11-23T09:00:00+01:00')
  engine(on, fake)
  await turn($)
  expect(fake.title).toBe('⏰ Thread')
})

test('no entry for this thread, or a broken snooze.json: ⏰ without a time, no problem reported', async ($, on) => {
  const fake = thread('Thread', IDS.snoozed)
  fake.files[SNOOZE_FILE] = entry('2026-11-23T09:00:00+01:00', 'another-thread')
  engine(on, fake)
  await turn($)
  expect(fake.title).toBe('⏰ Thread')
  fake.files[SNOOZE_FILE] = '{ not json'
  await turn($)
  expect(fake.title).toBe('⏰ Thread')
  fake.files[SNOOZE_FILE] = JSON.stringify({ snoozed: 'wrong shape' })
  await turn($)
  expect(fake.title).toBe('⏰ Thread')
  expect(JSON.parse(fake.files[HEALTH_FILE] ?? '{}').problems).toEqual([])
})

test('macOS: snooze.json is read under HOME', async ($, on) => {
  const fake = thread('Thread', IDS.snoozed)
  fake.env = { HOME: '/Users/mac' }
  fake.files[SNOOZE_FILE] = entry('2026-12-01T10:00:00-05:00')
  engine(on, fake)
  await turn($)
  expect(fake.title).toBe('⏰ 12-01 Tue 10 Thread')
  expect(fake.reads.some(path => path.replace(/\\/g, '/').includes('/Users/mac/.claude/threadkeeper/snooze.json'))).toBe(true)
})

test('woken by the sweep (moved out, entry gone, bare title): the next turn shows the normal icons', async ($, on) => {
  const fake = thread('Thread', IDS.active)
  fake.files[SNOOZE_FILE] = JSON.stringify({ version: 1, snoozed: [] })
  engine(on, fake)
  await turn($)
  expect(fake.titles).toEqual(['⏳ Thread', '🟢 Thread'])
})

test('a ✅ or ⏰ from another tool, outside the Threadkeeper sections, is left alone', async ($, on) => {
  const fake = thread('✅ Thread', IDS.other)
  engine(on, fake)
  await turn($)
  fake.title = '⏰ 11-23 Mon 09 Thread'
  await turn($)
  fake.title = '✅ Thread'
  fake.section = null
  await turn($)
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  expect(fake.titles).toEqual([])
})

test('a ⏰ Threadkeeper set (thread in its snooze list) is still replaced outside its sections', async ($, on) => {
  const fake = thread('⏰ 11-23 Mon 09 Thread', IDS.other)
  fake.files[SNOOZE_FILE] = entry('2026-11-23T09:00:00+01:00')
  engine(on, fake)
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  await turn($)
  expect(fake.titles).toEqual(['⏳ Thread', '🟢 Thread'])
})

test('start-up keeps the wake time of a snoozed thread, and a 🟢 still goes on a look', async ($, on) => {
  const fake = thread('⏰ 11-23 Mon 09 Thread', IDS.snoozed)
  fake.files[SNOOZE_FILE] = entry('2026-11-23T09:00:00+01:00')
  engine(on, fake)
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  expect(fake.titles).toEqual([])
  fake.title = '🟢 Thread'
  fake.section = IDS.active
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  await bandText($)
  expect(fake.titles).toEqual(['Thread'])
})

test('a ✅ from another tool on a thread moved into Active gets the normal icons', async ($, on) => {
  const fake = thread('✅ Thread', IDS.active)
  engine(on, fake)
  await turn($)
  expect(fake.titles).toEqual(['⏳ Thread', '🟢 Thread'])
})

test('a routine run records the engine only: no self-check, problems and checkedAt kept', async ($, on) => {
  const fake = thread('Run')
  fake.routine = true
  fake.files[HEALTH_FILE] = JSON.stringify({ engine: '2.1.300', checkedAt: 'old', problems: ['kept'] })
  engine(on, fake)
  await turn($)
  const health = JSON.parse(fake.files[HEALTH_FILE] ?? '{}')
  expect(health.engine).toBe('2.1.325')
  expect(typeof health.engineSeenAt).toBe('string')
  expect(health.checkedAt).toBe('old')
  expect(health.problems).toEqual(['kept'])
  expect(fake.titles).toEqual([])
})

test('a subagent still running keeps ⏳', async ($, on) => {
  const fake = thread('Thread', IDS.active, 2, ['running', 'completed'])
  engine(on, fake)
  await turn($)
  expect(fake.title).toBe('⏳ Thread')
})

test('a new thread: no ⏳ on its first turn, 🟢 at the end', async ($, on) => {
  const fake = thread('Thread', null, 1)
  engine(on, fake)
  await turn($)
  expect(fake.titles).toEqual(['🟢 Thread'])
})

test('start-up clears a stale ⏳ but keeps other icons; stacked icons collapse', async ($, on) => {
  const fake = thread('⏳ Thread', IDS.snoozed)
  engine(on, fake)
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  expect(fake.title).toBe('⏰ Thread')
  fake.title = '🟢 Thread'
  fake.section = IDS.active
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  expect(fake.title).toBe('🟢 Thread')
  fake.title = '⏳ 🟢 ⚠️ Thread'
  await turn($)
  expect(fake.title).toBe('🟢 Thread')
})

test('self-check passes: health file written, band left to the app', async ($, on) => {
  const fake = thread('Thread')
  engine(on, fake)
  await turn($)
  const health = JSON.parse(fake.files[HEALTH_FILE] ?? '{}')
  expect(health.problems).toEqual([])
  expect(health.engine).toBe('2.1.325')
  expect(health.version).toBe('0.6.2-team.1')
  expect(typeof health.lastTurnAt).toBe('string')
  expect(await bandText($)).toBe('engine')
})

test('self-check finds a lost section: health file and band say so', async ($, on) => {
  const fake = thread('Thread')
  fake.sidebar = [IDS.active, IDS.snoozed]
  engine(on, fake)
  await turn($)
  expect(JSON.parse(fake.files[HEALTH_FILE] ?? '{}').problems).toEqual(['the done section is gone from the sidebar'])
  const text = await bandText($)
  expect(text).toContain('Threadkeeper needs attention')
  expect(text).toContain('/threadkeeper:doctor')
})

test('a terminal session (no app tools): no titles, no band, no problems written', async ($, on) => {
  const fake = thread('Thread')
  fake.connect = { isConnected: false, reason: 'unlisted', message: 'not listed' }
  engine(on, fake)
  await turn($)
  expect(fake.titles).toEqual([])
  expect(fake.files[HEALTH_FILE]).toBe(undefined)
  expect(await bandText($)).toBe('engine')
})

test('app tools there but broken: the self-check reports it', async ($, on) => {
  const fake = thread('Thread')
  fake.connect = { isConnected: false, reason: 'failed', message: 'did not connect' }
  engine(on, fake)
  await turn($)
  const problems = JSON.parse(fake.files[HEALTH_FILE] ?? '{}').problems as string[]
  expect(problems[0]).toContain("the app's session tools do not answer")
})

test('macOS: files are found under HOME when USERPROFILE is not set', async ($, on) => {
  const fake = thread('Thread', IDS.done)
  fake.env = { HOME: '/Users/mac' }
  engine(on, fake)
  await turn($)
  expect(fake.title).toBe('✅ Thread')
  expect(fake.reads.some(path => path.replace(/\\/g, '/').includes('/Users/mac/.claude/threadkeeper/config.json'))).toBe(true)
})
