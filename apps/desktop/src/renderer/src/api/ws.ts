import { AI_WS_URL } from './config'
import type { WsMessage } from './protocol'

export interface SessionSocketHandlers {
  onOpen?: () => void
  onMessage?: (msg: WsMessage) => void
  onClose?: () => void
  onError?: (ev: Event) => void
}

export function connectSession(handlers: SessionSocketHandlers): WebSocket {
  const ws = new WebSocket(AI_WS_URL)
  ws.onopen = (): void => handlers.onOpen?.()
  ws.onmessage = (ev): void => {
    try {
      handlers.onMessage?.(JSON.parse(ev.data) as WsMessage)
    } catch {
      // bỏ qua message không hợp lệ
    }
  }
  ws.onclose = (): void => handlers.onClose?.()
  ws.onerror = (ev): void => handlers.onError?.(ev)
  return ws
}

export function sendMessage(
  ws: WebSocket,
  type: string,
  payload: Record<string, unknown> = {}
): void {
  ws.send(JSON.stringify({ type, ts: Date.now(), payload }))
}
