// Values the mod keeps in session state: they survive a hot reload of the code.
// blocked: Claude ended the turn on a question it cannot continue without.
export type Blocked = boolean

declare module 'claude-code' {
  interface PluginState {
    threadkeeper: { blocked: Blocked }
  }
}
