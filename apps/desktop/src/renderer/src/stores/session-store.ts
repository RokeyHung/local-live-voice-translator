// State phiên (Zustand). Dùng ngoài React qua getState() cho SessionController.
// applyMessage() gom các event WS thành: trạng thái pipeline, danh sách utterance
// (phụ đề song ngữ) và metrics độ trễ — UI chỉ đọc state đã gom sẵn.
//
// Pipeline hiện chưa gửi processingMs, nên khi thiếu, độ trễ từng khâu được đo ở
// client bằng khoảng cách giữa các event `state` (Recognizing → Translating →
// Synthesizing → Completed). Giá trị đo kiểu này gồm cả thời gian truyền WS nên
// được đánh dấu `measured` để hiển thị đúng bản chất.

import { create } from 'zustand'
import type { PipelineState, WsStatus } from '../domain/enums'
import type {
  AsrFinalPayload,
  AsrPartialPayload,
  ErrorPayload,
  MetricsPayload,
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
  lastTotalMs: number | null
  measured: boolean // true = đo ở client, false = do service báo về
  utteranceCount: number
}

// Mốc thời gian của từng khâu cho utterance đang chạy (chỉ để tính độ trễ).
interface StageMarks {
  recognizing?: number
  translating?: number
  synthesizing?: number
}

interface SessionState {
  wsStatus: WsStatus
  active: boolean
  muted: boolean
  ptt: boolean
  config: SessionConfig
  pipelineState: PipelineState | null
  // Id phiên trong lịch sử của service (service gửi kèm event state khi bắt đầu).
  historySessionId: string | null
  utterances: Utterance[]
  partial: { utteranceId: string; text: string } | null
  micLevel: number // RMS 0..1 của khung mic gần nhất
  systemLevel: number // RMS 0..1 của khung âm thanh hệ thống gần nhất
  systemCapturing: boolean // đang thu được âm thanh hệ thống (chiều incoming)
  ducking: boolean // đang tạm bỏ audio incoming vì TTS của mình đang phát
  metrics: Metrics
  lastError: ErrorPayload | null
  log: WsMessage[]

  setWsStatus: (status: WsStatus) => void
  setActive: (active: boolean) => void
  setMuted: (muted: boolean) => void
  setPtt: (ptt: boolean) => void
  setConfig: (patch: Partial<SessionConfig>) => void
  setMicLevel: (level: number) => void
  setSystemLevel: (level: number) => void
  setSystemCapturing: (capturing: boolean) => void
  setDucking: (ducking: boolean) => void
  applyMessage: (msg: WsMessage) => void
  clearTranscript: () => void
  reset: () => void
}

const EMPTY_METRICS: Metrics = {
  lastAsrMs: null,
  lastMtMs: null,
  lastTtsDurationMs: null,
  lastTotalMs: null,
  measured: false,
  utteranceCount: 0
}

// Mốc thời gian nằm ngoài store: là chi tiết đo đạc, không phải state hiển thị.
const marks = new Map<string, StageMarks>()

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

// Câu mà VAD cắt trúng đoạn chỉ có tiếng ồn: service chạy ASR, không ra chữ nào (hoặc
// ra câu ma và đã bị lọc) rồi báo thẳng Completed. Không có gì để hiện → bỏ hàng thay
// vì để lại một dòng phụ đề trống.
function dropIfEmpty(list: Utterance[], id: string): Utterance[] {
  const u = list.find((x) => x.id === id)
  if (!u || u.sourceText?.trim() || u.translatedText?.trim()) return list
  return list.filter((x) => x.id !== id)
}

export const useSessionStore = create<SessionState>((set) => ({
  wsStatus: 'disconnected',
  active: false,
  muted: false,
  ptt: false,
  config: DEFAULT_SESSION_CONFIG,
  pipelineState: null,
  historySessionId: null,
  utterances: [],
  partial: null,
  micLevel: 0,
  systemLevel: 0,
  systemCapturing: false,
  ducking: false,
  metrics: EMPTY_METRICS,
  lastError: null,
  log: [],

  setWsStatus: (wsStatus): void => set({ wsStatus }),
  setActive: (active): void => set({ active }),
  setMuted: (muted): void => set({ muted }),
  setPtt: (ptt): void => set({ ptt }),
  setConfig: (patch): void => set((s) => ({ config: { ...s.config, ...patch } })),
  setMicLevel: (micLevel): void => set({ micLevel }),
  setSystemLevel: (systemLevel): void => set({ systemLevel }),
  setSystemCapturing: (systemCapturing): void => set({ systemCapturing }),
  setDucking: (ducking): void => set({ ducking }),

  applyMessage: (msg): void =>
    set((s) => {
      const log = [...s.log.slice(-(MAX_LOG - 1)), msg]
      const p = msg.payload as Record<string, unknown>
      const now = Date.now()

      switch (msg.type) {
        case 'state': {
          const { state, utteranceId, sessionId } = p as unknown as StatePayload
          const historySessionId = sessionId ?? s.historySessionId
          if (!utteranceId) return { log, pipelineState: state, historySessionId }

          const mark = marks.get(utteranceId) ?? {}
          const patch: Partial<Utterance> = { state }
          let metrics = s.metrics

          if (state === 'Recognizing') {
            marks.set(utteranceId, { recognizing: now })
          } else if (state === 'Translating' && mark.recognizing) {
            mark.translating = now
            patch.asrMs = now - mark.recognizing
            patch.measured = true
            metrics = { ...metrics, lastAsrMs: patch.asrMs, measured: true }
          } else if (state === 'Synthesizing' && mark.translating) {
            mark.synthesizing = now
            patch.mtMs = now - mark.translating
            patch.measured = true
            metrics = { ...metrics, lastMtMs: patch.mtMs, measured: true }
          } else if (state === 'Completed') {
            const last = mark.synthesizing ?? mark.translating
            if (last) {
              const tail = now - last
              if (mark.synthesizing) {
                patch.ttsMs = tail
                metrics = { ...metrics, lastTtsDurationMs: tail, measured: true }
              } else {
                patch.mtMs = tail
                metrics = { ...metrics, lastMtMs: tail, measured: true }
              }
              patch.measured = true
            }
            if (mark.recognizing) {
              patch.totalMs = now - mark.recognizing
              metrics = { ...metrics, lastTotalMs: patch.totalMs }
            }
            marks.delete(utteranceId)
          }

          let utterances = upsert(s.utterances, utteranceId, patch)
          if (state === 'Completed') {
            const kept = dropIfEmpty(utterances, utteranceId)
            // Chỉ đếm những câu thật sự ra chữ — không thì mỗi khoảng lặng cũng làm
            // tăng số câu trên màn Chẩn đoán.
            if (kept.length === utterances.length) {
              metrics = { ...metrics, utteranceCount: metrics.utteranceCount + 1 }
            }
            utterances = kept
          }

          return {
            log,
            pipelineState: state,
            historySessionId,
            partial: state === 'Completed' ? null : s.partial,
            utterances,
            metrics
          }
        }
        case 'asr.partial': {
          const a = p as unknown as AsrPartialPayload
          return { log, partial: { utteranceId: a.utteranceId, text: a.text } }
        }
        case 'asr.final': {
          const a = p as unknown as AsrFinalPayload
          return {
            log,
            partial: null,
            utterances: upsert(s.utterances, a.utteranceId, {
              sourceLanguage: a.language,
              sourceText: a.text,
              ...(a.processingMs != null ? { asrMs: a.processingMs, measured: false } : {})
            }),
            metrics:
              a.processingMs != null
                ? { ...s.metrics, lastAsrMs: a.processingMs, measured: false }
                : s.metrics
          }
        }
        case 'mt.result': {
          const m = p as unknown as MtResultPayload
          return {
            log,
            utterances: upsert(s.utterances, m.utteranceId, {
              sourceText: m.sourceText,
              translatedText: m.translatedText,
              ...(m.processingMs != null ? { mtMs: m.processingMs, measured: false } : {})
            }),
            metrics:
              m.processingMs != null
                ? { ...s.metrics, lastMtMs: m.processingMs, measured: false }
                : s.metrics
          }
        }
        case 'tts.audio': {
          const t = p as unknown as TtsAudioPayload
          return {
            log,
            utterances: upsert(s.utterances, t.utteranceId, { ttsDurationMs: t.durationMs })
          }
        }
        case 'metrics': {
          const m = p as unknown as MetricsPayload
          return {
            log,
            metrics: {
              ...s.metrics,
              lastAsrMs: m.asrMs ?? s.metrics.lastAsrMs,
              lastMtMs: m.mtMs ?? s.metrics.lastMtMs,
              lastTtsDurationMs: m.ttsMs ?? s.metrics.lastTtsDurationMs,
              measured: false
            }
          }
        }
        case 'error':
          return { log, lastError: p as unknown as ErrorPayload }
        default:
          return { log }
      }
    }),

  clearTranscript: (): void => {
    marks.clear()
    set({
      utterances: [],
      partial: null,
      metrics: EMPTY_METRICS,
      lastError: null,
      historySessionId: null
    })
  },
  reset: (): void => {
    marks.clear()
    set({
      pipelineState: null,
      historySessionId: null,
      utterances: [],
      partial: null,
      metrics: EMPTY_METRICS,
      lastError: null,
      log: []
    })
  }
}))
