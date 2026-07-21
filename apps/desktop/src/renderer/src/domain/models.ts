// Mô hình nghiệp vụ phía client (thuần, không phụ thuộc React/transport).

import type { Language, PipelineState, Preset, SessionMode } from './enums'

export interface HealthResponse {
  status: 'ok'
  version: string
  offlineReady: boolean
  platform: string
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
  ttsDurationMs?: number
  state: PipelineState
  at: number
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  mode: 'two_way',
  outgoing: { source: 'vi', target: 'en' },
  incoming: { source: 'en', target: 'vi' },
  preset: 'balanced'
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  ja: '日本語',
  zh: '中文'
}

export const PRESET_LABELS: Record<Preset, string> = {
  fast: 'Fast',
  balanced: 'Balanced',
  quality: 'Quality'
}
