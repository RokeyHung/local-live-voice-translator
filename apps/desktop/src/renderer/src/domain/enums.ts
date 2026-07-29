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

export type AudioSource = 'microphone' | 'system'

export type Language = 'vi' | 'en' | 'ja' | 'zh'

export type SessionMode = 'listen' | 'speak' | 'two_way'

export type Preset = 'fast' | 'balanced' | 'quality'

// --- Khái niệm chỉ có ở client (không nằm trong contract WS/REST) ---

// Trạng thái kết nối WebSocket.
export type WsStatus = 'disconnected' | 'connecting' | 'connected'

// Bên phát ra một utterance: giọng của mình (mic) hay của phía cuộc họp.
export type Side = 'me' | 'remote'

// Khâu trong pipeline — dùng cho danh sách model và biểu đồ độ trễ.
export type Stage = 'VAD' | 'ASR' | 'MT' | 'TTS'

export type ScreenId =
  'session' | 'import' | 'setup' | 'models' | 'diagnostics' | 'history' | 'settings' | 'about'

export type ThemeMode = 'system' | 'light' | 'dark'

export type UiLanguage = 'vi' | 'en'

// Bố cục màn Phiên dịch.
export type SessionLayout = 'split' | 'timeline' | 'focus'

// Backend tính toán phát hiện được trên máy.
export type ComputeKind = 'nvidia' | 'apple' | 'amd' | 'intel' | 'cpu'

export type ComputeBackend = 'cuda' | 'metal' | 'vulkan' | 'cpu'
