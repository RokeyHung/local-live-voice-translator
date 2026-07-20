// State phiên (Zustand). Có thể dùng ngoài React qua getState() cho SessionController.

import { create } from 'zustand'
import type { WsStatus } from '../domain/enums'
import type { WsMessage } from '../domain/events'

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
