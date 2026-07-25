// State phiên (Zustand). Dùng ngoài React qua getState() cho SessionController.
// applyMessage() gom các event WS thành: trạng thái pipeline, danh sách utterance
// (phụ đề song ngữ) và metrics độ trễ — UI chỉ đọc state đã gom sẵn.

import { create } from 'zustand'
import type { PipelineState, WsStatus } from '../domain/enums'
import type {
  AsrFinalPayload,
  ErrorPayload,
  MtResultPayload,
  StatePayload,
  TtsAudioPayload,
  WsMessage
} from '../domain/events'
import { DEFAULT_SESSION_CONFIG, type SessionConfig, type Utterance } from '../domain/models'

const MAX_UTTERANCES = 100
const MAX_LOG = 100

export interface Metrics {
  lastAsrMs: number | null
  lastMtMs: number | null
  lastTtsDurationMs: number | null
  utteranceCount: number
}

interface SessionState {
  wsStatus: WsStatus
  active: boolean
  muted: boolean
  config: SessionConfig
  outputDeviceId: string // thiết bị đầu ra TTS (microphone ảo); '' = mặc định. Client-only.
  pipelineState: PipelineState | null
  utterances: Utterance[]
  metrics: Metrics
  lastError: ErrorPayload | null
  log: WsMessage[]

  setWsStatus: (status: WsStatus) => void
  setActive: (active: boolean) => void
  setMuted: (muted: boolean) => void
  setConfig: (patch: Partial<SessionConfig>) => void
  setOutputDeviceId: (deviceId: string) => void
  applyMessage: (msg: WsMessage) => void
  clearTranscript: () => void
  reset: () => void
}

const EMPTY_METRICS: Metrics = {
  lastAsrMs: null,
  lastMtMs: null,
  lastTtsDurationMs: null,
  utteranceCount: 0
}

function upsert(list: Utterance[], id: string, patch: Partial<Utterance>): Utterance[] {
  const idx = list.findIndex((u) => u.id === id)
  if (idx === -1) {
    const created: Utterance = { id, state: 'Recognizing', at: Date.now(), ...patch }
    return [...list, created].slice(-MAX_UTTERANCES)
  }
  const next = [...list]
  next[idx] = { ...next[idx], ...patch }
  return next
}

export const useSessionStore = create<SessionState>((set) => ({
  wsStatus: 'disconnected',
  active: false,
  muted: false,
  config: DEFAULT_SESSION_CONFIG,
  outputDeviceId: '',
  pipelineState: null,
  utterances: [],
  metrics: EMPTY_METRICS,
  lastError: null,
  log: [],

  setWsStatus: (wsStatus): void => set({ wsStatus }),
  setActive: (active): void => set({ active }),
  setMuted: (muted): void => set({ muted }),
  setConfig: (patch): void => set((s) => ({ config: { ...s.config, ...patch } })),
  setOutputDeviceId: (outputDeviceId): void => set({ outputDeviceId }),

  applyMessage: (msg): void =>
    set((s) => {
      const log = [...s.log.slice(-(MAX_LOG - 1)), msg]
      const p = msg.payload as Record<string, unknown>

      switch (msg.type) {
        case 'state': {
          const { state, utteranceId } = p as unknown as StatePayload
          return {
            log,
            pipelineState: state,
            utterances: utteranceId ? upsert(s.utterances, utteranceId, { state }) : s.utterances
          }
        }
        case 'asr.final': {
          const a = p as unknown as AsrFinalPayload
          return {
            log,
            utterances: upsert(s.utterances, a.utteranceId, {
              sourceLanguage: a.language,
              sourceText: a.text,
              asrMs: a.processingMs ?? undefined
            }),
            metrics: { ...s.metrics, lastAsrMs: a.processingMs ?? s.metrics.lastAsrMs }
          }
        }
        case 'mt.result': {
          const m = p as unknown as MtResultPayload
          return {
            log,
            utterances: upsert(s.utterances, m.utteranceId, {
              sourceText: m.sourceText,
              translatedText: m.translatedText,
              mtMs: m.processingMs ?? undefined
            }),
            metrics: { ...s.metrics, lastMtMs: m.processingMs ?? s.metrics.lastMtMs }
          }
        }
        case 'tts.audio': {
          const t = p as unknown as TtsAudioPayload
          return {
            log,
            utterances: upsert(s.utterances, t.utteranceId, { ttsDurationMs: t.durationMs }),
            metrics: {
              ...s.metrics,
              lastTtsDurationMs: t.durationMs,
              utteranceCount: s.metrics.utteranceCount + 1
            }
          }
        }
        case 'error':
          return { log, lastError: p as unknown as ErrorPayload }
        default:
          return { log }
      }
    }),

  clearTranscript: (): void => set({ utterances: [], metrics: EMPTY_METRICS }),
  reset: (): void =>
    set({
      pipelineState: null,
      utterances: [],
      metrics: EMPTY_METRICS,
      lastError: null,
      log: []
    })
}))
