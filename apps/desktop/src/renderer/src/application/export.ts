// Xuất bản ghi một phiên ra .txt / .srt và tải xuống (Blob URL — không rời khỏi máy).

import { rowSide, type HistorySessionDetail, type TranscriptSegment } from '../domain/models'
import { formatDuration } from './format'
import type { Dict } from './i18n'
import { speakerLabel } from './speakers'
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

// --- Nhập tệp: mốc thời gian là vị trí trong tệp, nên .srt khớp thẳng với bản ghi gốc ---

// `L` chỉ dùng để dịch mã người nói (`speaker-1` → "Người nói 1"). Tệp không bật
// diarization thì không có nhãn nào và bản xuất giống hệt như trước.
export function transcriptToTxt(name: string, segments: TranscriptSegment[], L: Dict): string {
  const body = segments
    .map((s) => {
      const who = speakerLabel(s.speaker, L)
      const head = `[${formatDuration(s.startedAtMs)}]${who ? ` ${who}:` : ''} ${s.text}`
      return s.translatedText ? `${head}\n  → ${s.translatedText}` : head
    })
    .join('\n\n')
  return `${name}\n\n${body}\n`
}

export function transcriptToSrt(segments: TranscriptSegment[], L: Dict): string {
  return segments
    .map((s, i) => {
      const who = speakerLabel(s.speaker, L)
      // Quy ước chung của phụ đề có nhiều người nói: tên đặt trong ngoặc vuông ở
      // đầu dòng, đúng kiểu `sessionToSrt` đang dùng cho [Me]/[Remote].
      const line = `${who ? `[${who}] ` : ''}${s.translatedText ?? s.text}`
      return `${i + 1}\n${srtTime(s.startedAtMs)} --> ${srtTime(s.endedAtMs)}\n${line}\n`
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
