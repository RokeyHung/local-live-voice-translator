// Port: kênh phiên realtime (WebSocket) tới Local AI Service.

import type { WsMessage } from '../domain/events'

export interface SessionChannelHandlers {
  onOpen?: () => void
  onEvent?: (msg: WsMessage) => void
  onClose?: () => void
  onError?: (event: Event) => void
}

export interface SessionChannel {
  connect(handlers: SessionChannelHandlers): void
  send(type: string, payload?: Record<string, unknown>): void
  close(): void
}
