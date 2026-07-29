// Suy ra bên phát của một utterance.
//
// Contract WS không nói câu này đến từ mic hay từ âm thanh hệ thống, nhưng mỗi
// chiều dịch có cặp ngôn ngữ riêng: chiều outgoing bắt đầu từ ngôn ngữ của mình,
// chiều incoming từ ngôn ngữ cuộc họp. Ở chế độ một chiều thì khỏi đoán.

import type { Side } from '../domain/enums'
import type { SessionConfig, Utterance } from '../domain/models'

export function utteranceSide(utterance: Utterance, config: SessionConfig): Side {
  if (config.mode === 'listen') return 'remote'
  if (config.mode === 'speak') return 'me'
  return utterance.sourceLanguage === config.outgoing.source ? 'me' : 'remote'
}

export function formatClock(atMs: number): string {
  const d = new Date(atMs)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function formatDateTime(atMs: number): string {
  const d = new Date(atMs)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} · ${p(d.getHours())}:${p(d.getMinutes())}`
}
