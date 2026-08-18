// Envelope + payload WebSocket (mirror của ws/protocol.py + schemas bên ai-service).
// WS envelope là { type, ts, payload }. Xem "Contract sync" trong CLAUDE.md.

import type { Language, PipelineState } from './enums'

export interface WsMessage<P = Record<string, unknown>> {
  type: string
  ts: number
  payload: P
}

// server → client
export interface StatePayload {
  state: PipelineState
  utteranceId?: string
  // Chỉ có ở mốc Listening (bắt đầu) và Stopped: id phiên trong lịch sử service.
  sessionId?: string | null
}

export interface AsrPartialPayload {
  utteranceId: string
  language: Language
  text: string
}

export interface AsrFinalPayload {
  utteranceId: string
  language: Language
  text: string
  confidence?: number | null
  processingMs?: number | null
}

export interface MtResultPayload {
  utteranceId: string
  sourceText: string
  translatedText: string
  processingMs?: number | null
}

export interface TtsAudioPayload {
  utteranceId: string
  pcm: string // base64 PCM signed 16-bit mono
  sampleRate: number
  durationMs: number
}

export interface MetricsPayload {
  asrMs?: number | null
  mtMs?: number | null
  ttsMs?: number | null
}

export interface ErrorPayload {
  code: string
  message: string
  utteranceId?: string
}
