// Enum/union nghiệp vụ phía client (mirror của domain/enums.py bên ai-service).

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

// 'file' = câu đến từ một tệp người dùng nhập ở màn Nhập tệp (không phải audio thu).
export type AudioSource = 'microphone' | 'system' | 'file'

export type Language = 'vi' | 'en' | 'ja' | 'zh'

export type SessionMode = 'listen' | 'speak' | 'two_way'

// 'custom' = người dùng tự chọn model từng khâu (lựa chọn nằm ở service).
export type Preset = 'fast' | 'balanced' | 'quality' | 'custom'

// Kết quả chạy pipeline của một câu trong lịch sử.
export type UtteranceStatus = 'success' | 'failed'

// --- Khái niệm chỉ có ở client (không nằm trong contract WS/REST) ---

// Trạng thái kết nối WebSocket.
export type WsStatus = 'disconnected' | 'connecting' | 'connected'

// Bên phát ra một utterance: giọng của mình (mic) hay của phía cuộc họp.
export type Side = 'me' | 'remote'

// Khâu trong pipeline — dùng cho danh sách model và biểu đồ độ trễ. 'DIA' (tách
// người nói) chỉ xuất hiện khi bật diarization, và chỉ chạy ở màn Nhập tệp.
export type Stage = 'VAD' | 'ASR' | 'MT' | 'TTS' | 'DIA'

export type ScreenId =
  | 'session'
  | 'import'
  | 'setup'
  | 'models'
  | 'diagnostics'
  | 'history'
  | 'evaluate'
  | 'settings'
  | 'about'
  | 'logs'

// Nhật ký sự kiện của ỨNG DỤNG (màn Nhật ký) — khác với `log` trong session-store,
// chỗ đó giữ nguyên văn message WebSocket để soi giao thức ở màn Chẩn đoán.
export type LogLevel = 'info' | 'warn' | 'error'

// Nơi phát ra sự kiện; hiện đúng ở cột thứ ba của màn Nhật ký.
export type LogSource =
  | 'app'
  | 'system'
  | 'service'
  | 'session'
  | 'models'
  | 'import'
  | 'benchmark'
  | 'storage'
  | 'evaluate'

export type ThemeMode = 'system' | 'light' | 'dark'

export type UiLanguage = 'vi' | 'en'

// Bố cục màn Phiên dịch.
export type SessionLayout = 'split' | 'timeline' | 'focus'

// Backend tính toán phát hiện được trên máy.
export type ComputeKind = 'nvidia' | 'apple' | 'amd' | 'intel' | 'cpu'

export type ComputeBackend = 'cuda' | 'metal' | 'vulkan' | 'cpu'
