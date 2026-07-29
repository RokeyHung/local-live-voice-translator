// Mô hình nghiệp vụ phía client (thuần, không phụ thuộc React/transport).

import type {
  ComputeBackend,
  ComputeKind,
  Language,
  PipelineState,
  Preset,
  SessionMode,
  Side,
  Stage
} from './enums'

export interface HealthResponse {
  status: 'ok'
  version: string
  offlineReady: boolean
  platform: string
}

// Kết quả đo độ trễ từng khâu do AI service trả về (POST /api/benchmark).
export interface BenchmarkResponse {
  vadMs: number
  asrMs: number
  mtMs: number
  ttsMs: number | null // null khi ngôn ngữ đích chưa có voice TTS
  totalMs: number
  audioMs: number
  source: Language
  target: Language
  preset: Preset | null
}

// Tài nguyên của chính tiến trình AI service (GET /api/resources).
export interface ResourceResponse {
  cpuPercent: number
  cpuCount: number
  rssMb: number
  systemTotalMb: number
  systemUsedPercent: number
  threads: number
}

export interface ConfigResponse {
  preset: Preset
  availablePresets: Preset[]
}

export interface LanguagePair {
  source: Language
  target: Language
}

export interface SessionConfig {
  mode: SessionMode
  outgoing: LanguagePair // user → remote (Speak)
  incoming: LanguagePair // remote → user (Listen)
  preset: Preset
}

// Một utterance hiển thị trên subtitle: gom asr.final + mt.result + tts.audio theo id.
export interface Utterance {
  id: string
  sourceLanguage?: Language
  targetLanguage?: Language
  sourceText?: string
  translatedText?: string
  asrMs?: number
  mtMs?: number
  ttsMs?: number
  ttsDurationMs?: number
  totalMs?: number
  measured?: boolean // true = độ trễ do client đo, false = do service báo
  state: PipelineState
  at: number
}

// Một dòng đã hoàn tất, được ghi vào cuộc họp (lưu cục bộ).
export interface MeetingRow {
  id: string
  side: Side
  atMs: number
  sourceLanguage?: Language
  targetLanguage?: Language
  sourceText: string
  translatedText: string
  asrMs?: number
  mtMs?: number
  ttsMs?: number
}

// Mỗi lần nhấn Bắt đầu tạo một cuộc họp; lưu trong localStorage.
export interface Meeting {
  id: string
  title: string
  startedAtMs: number
  endedAtMs?: number
  rows: MeetingRow[]
}

export interface GlossaryEntry {
  id: string
  source: string
  target: string
}

// Một model cụ thể mà preset đang dùng cho một khâu của pipeline.
export interface StageModel {
  stage: Stage
  adapter: string
  model: string
}

// Phần cứng phát hiện được từ renderer (navigator + WebGL). Không có API hệ thống
// nào khác trong sandbox nên các giá trị thiếu để null.
export interface ComputeInfo {
  kind: ComputeKind
  gpuRenderer: string
  gpuVendor: string
  cpuCores: number | null
  ramGb: number | null
  ramCapped: boolean // deviceMemory bị chặn trần ở 8 GB → giá trị thật có thể lớn hơn
  webgpu: boolean
  recommended: ComputeBackend
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  mode: 'two_way',
  outgoing: { source: 'vi', target: 'en' },
  incoming: { source: 'en', target: 'vi' },
  preset: 'balanced'
}

export const LANGUAGES: Language[] = ['vi', 'en', 'ja', 'zh']

export const PRESETS: Preset[] = ['fast', 'balanced', 'quality']

export const PRESET_LABELS: Record<Preset, string> = {
  fast: 'Fast',
  balanced: 'Balanced',
  quality: 'Quality'
}
