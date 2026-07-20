// Use-case: điều phối kênh phiên và cập nhật store (tương tự SessionController bên ai-service).
// Chỉ phụ thuộc PORT (SessionChannel), không phụ thuộc adapter cụ thể.

import type { SessionChannel } from '../ports/session-channel'
import { useSessionStore } from '../stores/session-store'

export class SessionController {
  constructor(private readonly channel: SessionChannel) {}

  connect(): void {
    const store = useSessionStore.getState()
    store.setWsStatus('connecting')
    this.channel.connect({
      onOpen: () => useSessionStore.getState().setWsStatus('connected'),
      onEvent: (msg) => useSessionStore.getState().pushMessage(msg),
      onClose: () => useSessionStore.getState().setWsStatus('disconnected'),
      onError: () => useSessionStore.getState().setWsStatus('disconnected')
    })
  }

  startSession(mode: string = 'two_way'): void {
    this.channel.send('session.start', { mode })
  }

  ptt(pressed: boolean): void {
    this.channel.send('control.ptt', { pressed })
  }

  stopSession(): void {
    this.channel.send('session.stop')
  }

  dispose(): void {
    this.channel.close()
  }
}
