// Bản TypeScript mirror của quy ước giao tiếp.
// Đồng bộ với apps/ai-service/src/llvt_ai_service/protocol.py khi thay đổi contract.

export interface HealthResponse {
  status: 'ok'
  version: string
  offlineReady: boolean
  platform: string
}

export type PipelineState =
  | 'Idle'
  | 'Listening'
  | 'SpeechDetected'
  | 'Recognizing'
  | 'Translating'
  | 'WaitingForConfirmation'
  | 'Synthesizing'
  | 'Queued'
  | 'Speaking'
  | 'Completed'
  | 'Error'
  | 'Stopped'

export type AudioSource = 'microphone' | 'system'

export interface WsMessage<P = Record<string, unknown>> {
  type: string
  ts: number
  payload: P
}
