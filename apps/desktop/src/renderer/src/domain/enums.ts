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

// Trạng thái kết nối WebSocket (khái niệm riêng của client).
export type WsStatus = 'disconnected' | 'connecting' | 'connected'
