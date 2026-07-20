import { create } from 'zustand'
import type { WsMessage } from '../api/protocol'

export type WsStatus = 'disconnected' | 'connecting' | 'connected'

interface SessionState {
  wsStatus: WsStatus
  lastState: string | null
  log: WsMessage[]
  setWsStatus: (status: WsStatus) => void
  pushMessage: (msg: WsMessage) => void
  reset: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  wsStatus: 'disconnected',
  lastState: null,
  log: [],
  setWsStatus: (wsStatus): void => set({ wsStatus }),
  pushMessage: (msg): void =>
    set((s) => ({
      log: [...s.log.slice(-49), msg],
      lastState:
        msg.type === 'state'
          ? ((msg.payload as { state?: string }).state ?? s.lastState)
          : s.lastState
    })),
  reset: (): void => set({ lastState: null, log: [] })
}))
