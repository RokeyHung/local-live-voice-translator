// Mô hình nghiệp vụ phía client (thuần, không phụ thuộc React/transport).

import type {
  AudioSource,
  ComputeBackend,
  ComputeKind,
  Language,
  LogLevel,
  LogSource,
  PipelineState,
  Preset,
  SessionMode,
  Side,
  Stage,
  UtteranceStatus
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
  ttsMs: number | null // null khi máy chưa tải được voice cho ngôn ngữ đích
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

// Một khâu pipeline kèm model + thiết bị THẬT mà service đang chạy.
export interface StageInfo {
  stage: Stage
  adapter: string
  model: string
  accel: string
  loaded: boolean
}

export interface ConfigResponse {
  preset: Preset
  availablePresets: Preset[]
  stages: StageInfo[]
  modelsDir: string
  modelsDirEditable: boolean // false khi LLVT_MODELS_DIR đang quyết định
  historyDbPath: string
  historyEnabled: boolean
}

// Tiến trình nạp model (GET /api/models/progress), hỏi trong lúc lệnh nạp đang chạy.
export type LoadStageStatus = 'waiting' | 'downloading' | 'loading' | 'done' | 'failed'

export interface StageProgress {
  stage: Stage
  model: string
  status: LoadStageStatus
  // Số byte ĐO ĐƯỢC trên đĩa. `totalBytes`/`percent` là null khi không biết dung lượng
  // model — giao diện hiện số MB thay vì phần trăm bịa. `estimated` = tổng chỉ xấp xỉ.
  doneBytes: number
  totalBytes: number | null
  estimated: boolean
  percent: number | null
  note: string
}

export interface LoadProgress {
  active: boolean
  currentStage: Stage | null
  overallPercent: number | null
  error: string | null
  stages: StageProgress[]
}

// Kết quả DELETE /api/models.
export interface DeletedModels {
  removed: string[]
  freedBytes: number
}

// Model đã tải thật trên đĩa (GET /api/models) — dung lượng là số thật.
export interface InstalledModel {
  name: string
  stage: Stage
  path: string
  sizeBytes: number
}

// --- Nhập tệp (mirror schemas.py: TranscriptSegmentSchema / TranscriptionResponse) ---

export interface TranscriptSegment {
  startedAtMs: number // mốc tính từ ĐẦU TỆP, không phải giờ đồng hồ
  endedAtMs: number
  text: string
  translatedText: string | null // null khi chỉ nhận dạng chữ, không dịch
  asrMs: number | null
  mtMs: number | null
}

export interface TranscriptionResult {
  source: Language
  target: Language | null
  audioMs: number
  processingMs: number
  segments: TranscriptSegment[]
  sessionId: string // rỗng = không lưu vào lịch sử
  // true = dừng giữa chừng theo yêu cầu; `segments` chỉ là phần đã chạy được.
  cancelled: boolean
}

// Tiến trình tệp đang chạy (GET /api/transcribe/progress), hỏi trong lúc POST còn chặn.
export interface TranscribeProgress {
  active: boolean
  fileName: string
  audioMs: number
  doneMs: number
  segments: number
  percent: number | null
  error: string | null
  cancelling: boolean // đã xin dừng, đang chờ khúc hiện tại chạy nốt
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

// --- Lịch sử phiên (mirror schemas.py: SessionSummary / UtteranceSchema / SessionDetail) ---
//
// Nguồn dữ liệu là SQLite bên ai-service (GET /api/sessions), không phải localStorage:
// lịch sử phải còn sau khi tắt app và xoá được ở một chỗ duy nhất.

export interface HistorySession {
  id: string
  title: string
  startedAtMs: number
  endedAtMs?: number | null // rỗng = đang chạy, hoặc phiên bị bỏ dở
  mode?: SessionMode | null
  preset?: Preset | null
  utteranceCount: number
}

export interface HistoryRow {
  id: string
  source: AudioSource
  sourceLanguage: Language
  targetLanguage: Language
  sourceText?: string | null
  translatedText?: string | null
  asrMs?: number | null
  mtMs?: number | null
  ttsMs?: number | null
  status: UtteranceStatus
  error?: string | null
  startedAtMs: number
  endedAtMs?: number | null
}

export interface HistorySessionDetail extends HistorySession {
  utterances: HistoryRow[]
}

// Bên phát suy ra thẳng từ nguồn audio đã lưu (không phải đoán theo cặp ngôn ngữ).
export function rowSide(row: HistoryRow): Side {
  return row.source === 'microphone' ? 'me' : 'remote'
}

export interface GlossaryEntry {
  id: string
  source: string
  target: string
}

// Một dòng trong màn Nhật ký. `message` đã là câu hoàn chỉnh theo ngôn ngữ giao diện
// tại lúc ghi — nhật ký là biên bản của việc đã xảy ra, đổi ngôn ngữ sau đó không
// viết lại quá khứ.
export interface LogEntry {
  id: string
  at: number // epoch ms
  level: LogLevel
  source: LogSource
  message: string
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
