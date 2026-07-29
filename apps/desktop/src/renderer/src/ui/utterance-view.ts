// Chuyển utterance của store thành dữ liệu sẵn sàng hiển thị (màu theo bên phát,
// nhãn trạng thái, bản dịch đã áp glossary).

import { applyGlossary } from '../application/glossary'
import type { Dict } from '../application/i18n'
import type { PipelineState, Side } from '../domain/enums'
import type { GlossaryEntry, Utterance } from '../domain/models'

export const SIDE_COLOR: Record<Side, string> = { me: '#22d3ee', remote: '#d946ef' }

export interface ViewUtterance extends Utterance {
  side: Side
  displayTarget: string
}

export function statusMeta(state: PipelineState, L: Dict): { text: string; color: string } {
  switch (state) {
    case 'Recognizing':
    case 'SpeechDetected':
    case 'Listening':
      return { text: L.stRecognizing, color: '#22d3ee' }
    case 'Translating':
      return { text: L.stTranslating, color: '#fb923c' }
    case 'Synthesizing':
    case 'Queued':
    case 'Speaking':
      return { text: L.stSpeaking, color: '#d946ef' }
    case 'WaitingForConfirmation':
      return { text: L.stWaiting, color: '#fbbf24' }
    case 'Error':
      return { text: L.stFailed, color: '#f87171' }
    default:
      return { text: L.stCompleted, color: '#22c55e' }
  }
}

export function toView(utterance: Utterance, side: Side, glossary: GlossaryEntry[]): ViewUtterance {
  return {
    ...utterance,
    side,
    displayTarget: applyGlossary(utterance.translatedText ?? '', glossary)
  }
}
