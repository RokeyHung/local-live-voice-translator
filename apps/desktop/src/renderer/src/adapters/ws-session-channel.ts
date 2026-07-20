// Adapter: hiện thực SessionChannel bằng WebSocket trình duyệt.

import { AI_WS_URL } from '../application/config'
import type { WsMessage } from '../domain/events'
import type { SessionChannel, SessionChannelHandlers } from '../ports/session-channel'

export class WsSessionChannel implements SessionChannel {
  private ws: WebSocket | null = null

  connect(handlers: SessionChannelHandlers): void {
    const ws = new WebSocket(AI_WS_URL)
    ws.onopen = (): void => handlers.onOpen?.()
    ws.onmessage = (ev): void => {
      try {
        handlers.onEvent?.(JSON.parse(ev.data) as WsMessage)
      } catch {
        // bỏ qua message không hợp lệ
      }
    }
    ws.onclose = (): void => handlers.onClose?.()
    ws.onerror = (ev): void => handlers.onError?.(ev)
    this.ws = ws
  }

  send(type: string, payload: Record<string, unknown> = {}): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ts: Date.now(), payload }))
    }
  }

  close(): void {
    this.ws?.close()
    this.ws = null
  }
}
