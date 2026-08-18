// Xuất bản ghi một phiên ra .txt / .srt và tải xuống (Blob URL — không rời khỏi máy).

import { rowSide, type HistorySessionDetail } from '../domain/models'
import { formatClock, formatDateTime } from './utterances'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function srtTime(offsetMs: number): string {
  const total = Math.max(0, Math.floor(offsetMs / 1000))
  const ms = Math.floor(offsetMs % 1000)
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)},${String(ms).padStart(3, '0')}`
}

export function sessionToTxt(session: HistorySessionDetail): string {
  const body = session.utterances
    .map(
      (row) =>
        `[${formatClock(row.startedAtMs)}] ${rowSide(row) === 'me' ? 'ME' : 'REMOTE'}\n  ${row.sourceText ?? ''}\n  → ${row.translatedText ?? ''}`
    )
    .join('\n\n')
  return `${session.title}\n${formatDateTime(session.startedAtMs)}\n\n${body}\n`
}

export function sessionToSrt(session: HistorySessionDetail): string {
  const rows = session.utterances
  return rows
    .map((row, i) => {
      const start = row.startedAtMs - session.startedAtMs
      const next = rows[i + 1]
      const end = next ? next.startedAtMs - session.startedAtMs : start + 4000
      const who = rowSide(row) === 'me' ? '[Me]' : '[Remote]'
      return `${i + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${who} ${row.translatedText ?? ''}\n`
    })
    .join('\n')
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
