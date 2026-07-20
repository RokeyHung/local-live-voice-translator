// Envelope WebSocket (mirror của ws/protocol.py bên ai-service).

export interface WsMessage<P = Record<string, unknown>> {
  type: string
  ts: number
  payload: P
}
