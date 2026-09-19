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

// GET/PUT /api/compute — mirror của ComputeResponse trong schemas.py.
// Phần cứng do AI service thấy (chính tiến trình chạy model), không phải renderer.
export interface ComputeDevice {
  id: string // tên thật của card — cũng là giá trị gửi lên khi chọn
  backend: string // 'Vulkan' | 'Metal' | 'CUDA'
  kind: 'discrete' | 'integrated'
  memoryMb: number | null
}

export interface ComputeStatus {
  choice: string // 'auto' | 'cpu' | id của một GPU
  devices: ComputeDevice[]
  deviceSelectable: boolean
  activeDevice: string | null // thiết bị ASR đang chạy; null = chưa nạp
  asrAdapter: string | null
  platform: string
  cpuName: string
  cpuCores: number | null
  ramGb: number | null
}

export interface GpuUsage {
  name: string
  percent: number // 0–100
}

// Tài nguyên máy + tiến trình AI service (GET /api/resources).
export interface ResourceResponse {
  cpuPercent: number // % MỘT lõi của tiến trình service — vượt 100 được, đừng hiển thị thẳng
  cpuCount: number
  systemCpuPercent: number // % CPU toàn máy, 0–100, như Task Manager
  gpus: GpuUsage[] // rỗng khi hệ điều hành không cho đọc (macOS)
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
  // Tách người nói có bật không (LLVT_DIARIZATION_ENABLED). Chỉ ảnh hưởng màn Nhập tệp.
  diarizationEnabled: boolean
  // Token HuggingFace: service KHÔNG BAO GIỜ trả nguyên văn, chỉ cờ + đoạn che.
  hfTokenSet: boolean
  hfTokenSource: HfTokenSource
  hfTokenHint: string
  hfTokenEditable: boolean // false khi LLVT_HF_TOKEN đang quyết định
  // Bộ model của preset 'custom' + những lựa chọn service thật sự chạy được.
  custom: CustomChoice | null
}

export interface CustomChoice {
  asrAdapter: string
  asrModel: string
  mtModel: string
  // Danh sách lấy từ registry của service — giao diện không chép tay bảng nào.
  asrAdapterChoices: string[]
  // Theo TỪNG runtime: ba runtime dùng ba định dạng model khác nhau nên không có
  // model nào dùng chung được. Gộp một danh sách là mời chọn tổ hợp không tồn tại.
  asrModelChoices: Record<string, string[]>
  mtModelChoices: string[]
}

// 'env' = LLVT_HF_TOKEN (app không sửa được) · 'saved' = ô nhập trong app ·
// 'inherited' = biến HF_TOKEN người dùng tự export · 'none' = chưa có.
export type HfTokenSource = 'env' | 'saved' | 'inherited' | 'none'

// Kết quả hỏi huggingface.co xem token có dùng được không (POST /api/hf/verify).
export interface HfVerifyResult {
  ok: boolean
  user: string
  error: string
}

// Tiến trình nạp model (GET /api/models/progress), hỏi trong lúc lệnh nạp đang chạy.
export type LoadStageStatus =
  'waiting' | 'downloading' | 'loading' | 'done' | 'failed' | 'cancelled'

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
  cancelling: boolean // đã bấm Huỷ, đang chờ khâu hiện tại chạy nốt
  currentStage: Stage | null
  overallPercent: number | null
  error: string | null
  stages: StageProgress[]
}

// Runtime sẽ chạy một model tải từ HuggingFace ngoài danh mục. Bắt buộc phải nói rõ:
// nhìn `org/repo` thì repo nào cũng như repo nào.
export type DownloadKind = 'whisper_cpp' | 'mlx' | 'faster_whisper' | 'nllb' | 'pyannote'

// Kết quả POST /api/models/download.
export interface DownloadedModel {
  name: string
  stage: Stage
  path: string
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
  // false = tải dở dang: có trên đĩa nhưng thiếu file, nạp sẽ hỏng. Không được tính
  // là "đã tải" ở bất cứ đâu — phải xoá hoặc tải lại.
  complete: boolean
}

// Dung lượng đĩa service đang chiếm (GET /api/storage). `key` mở rộng được nên để
// string: giao diện chỉ biết những key nó vẽ được và bỏ qua phần còn lại.
export interface StorageItem {
  key: string
  path: string
  sizeBytes: number
}

export interface StorageUsage {
  items: StorageItem[]
  totalBytes: number
}

// --- Nhập tệp (mirror schemas.py: TranscriptSegmentSchema / TranscriptionResponse) ---

export interface TranscriptSegment {
  startedAtMs: number // mốc tính từ ĐẦU TỆP, không phải giờ đồng hồ
  endedAtMs: number
  text: string
  translatedText: string | null // null khi chỉ nhận dạng chữ, không dịch
  asrMs: number | null
  mtMs: number | null
  // Mã người nói (`speaker-1`, `speaker-2`…) khi bật diarization; null = không bật,
  // hoặc đoạn rơi vào chỗ chuyển lượt nên không ai chiếm đủ đa số thời lượng.
  speaker: string | null
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
  speakerCount: number // 0 = không chạy diarization cho tệp này
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
  // 'diarizing' = đang gom cụm giọng trên CẢ tệp (percent còn 0), 'transcribing' =
  // đang nhận dạng + dịch theo từng đoạn.
  phase: 'diarizing' | 'transcribing'
}

// --- Đánh giá (mirror schemas.py: Evaluation*) ---

export interface EvaluationCase {
  id: string
  language: Language
  target: Language
  transcript: string // câu gốc chuẩn — vừa là tham chiếu ASR, vừa là đầu vào MT
  translation: string // bản dịch tham chiếu
  audio: string // đường dẫn TUYỆT ĐỐI tới WAV; rỗng = service tự đọc bằng TTS
}

export interface EvaluationCaseResult {
  id: string
  language: Language
  target: Language
  // 'recorded' = giọng người thật · 'tts-roundtrip' = máy tự đọc rồi tự nghe lại
  audioSource: 'recorded' | 'tts-roundtrip'
  reference: string
  hypothesis: string
  errorRate: number
  metric: string // 'WER' cho vi/en · 'CER' cho zh/ja
  referenceTranslation: string
  translation: string
  chrf: number
  asrMs: number
  mtMs: number
  audioMs: number
}

export interface EvaluationResult {
  cases: EvaluationCaseResult[]
  errorRate: number
  chrf: number
  asrP50Ms: number
  asrP90Ms: number
  mtP50Ms: number
  mtP90Ms: number
  totalP90Ms: number
  rtfP90: number
  // true = có ít nhất một câu chạy bằng giọng tổng hợp → số LẠC QUAN hơn thực tế.
  hasSyntheticAudio: boolean
  cancelled: boolean
}

export interface EvaluationProgress {
  active: boolean
  total: number
  done: number
  currentCase: string
  percent: number | null
  error: string | null
  cancelling: boolean
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
  // SPEC 7.10: dừng lại cho người dùng sửa bản dịch trước khi đọc ra micro ảo.
  // Chỉ áp cho chiều outgoing — câu của phía bên kia không phải của mình mà sửa.
  reviewBeforeSpeaking: boolean
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
  // Mã người nói với phiên là tệp nhập có bật diarization; null với phiên trực tiếp
  // (ở đó `source` đã cho biết ai nói).
  speaker?: string | null
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
  preset: 'balanced',
  // Mặc định TẮT: chế độ dịch trực tiếp lấy độ trễ thấp làm chính, còn duyệt tay thì
  // mỗi câu phải chờ người dùng bấm. Bật ở màn Cài đặt khi cần chính xác hơn nhanh.
  reviewBeforeSpeaking: false
}

export const LANGUAGES: Language[] = ['vi', 'en', 'ja', 'zh']

// Ba mức dựng sẵn; 'custom' hiện riêng ở ô thứ tư nên không nằm trong danh sách này.
export const PRESETS: Preset[] = ['fast', 'balanced', 'quality']

export const PRESET_LABELS: Record<Preset, string> = {
  fast: 'Fast',
  balanced: 'Balanced',
  quality: 'Quality',
  custom: 'Custom'
}
