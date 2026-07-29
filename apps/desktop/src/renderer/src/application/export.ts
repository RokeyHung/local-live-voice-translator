// Xuất một cuộc họp ra .txt / .srt và tải xuống (Blob URL — không rời khỏi máy).

import type { Meeting } from '../domain/models'
import { formatClock, formatDateTime } from './utterances'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function srtTime(offsetMs: number): string {
  const total = Math.max(0, Math.floor(offsetMs / 1000))
  const ms = Math.floor(offsetMs % 1000)
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)},${String(ms).padStart(3, '0')}`
}

export function meetingToTxt(meeting: Meeting): string {
  const body = meeting.rows
    .map(
      (row) =>
        `[${formatClock(row.atMs)}] ${row.side === 'me' ? 'ME' : 'REMOTE'}\n  ${row.sourceText}\n  → ${row.translatedText}`
    )
    .join('\n\n')
  return `${meeting.title}\n${formatDateTime(meeting.startedAtMs)}\n\n${body}\n`
}

export function meetingToSrt(meeting: Meeting): string {
  return meeting.rows
    .map((row, i) => {
      const start = row.atMs - meeting.startedAtMs
      const next = meeting.rows[i + 1]
      const end = next ? next.atMs - meeting.startedAtMs : start + 4000
      const who = row.side === 'me' ? '[Me]' : '[Remote]'
      return `${i + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${who} ${row.translatedText}\n`
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
