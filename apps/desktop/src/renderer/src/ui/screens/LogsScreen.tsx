// Màn Nhật ký: sự kiện và lỗi của ứng dụng, mới nhất lên đầu.
//
// Đây là nhật ký của TIẾN TRÌNH GIAO DIỆN — mọi thứ trong này do chính renderer ghi
// lại (xem application/logger.ts). Log của AI service nằm ở stdout của tiến trình
// Python, service chưa có endpoint nào để đọc lại nên không gộp vào đây được.
//
// Nhật ký nguyên văn message WebSocket vẫn ở màn Chẩn đoán: nó phục vụ việc soi giao
// thức, còn màn này là dòng thời gian sự kiện ở mức người dùng hiểu được.

import type { JSX } from 'react'
import { downloadText } from '../../application/export'
import { formatClock } from '../../application/utterances'
import type { LogLevel } from '../../domain/enums'
import type { LogEntry } from '../../domain/models'
import { useDict } from '../../hooks/use-ui'
import { useLogStore, type LogFilter } from '../../stores/log-store'
import { Icon } from '../components/Icon'
import { ScreenHeader, Segmented } from '../components/primitives'
import { DANGER_BUTTON, GHOST_BUTTON, SCREEN } from '../styles'

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: 'var(--ac-cyan)',
  warn: 'var(--ac-org)',
  error: '#f87171'
}

// Nền của cả dòng, chỉ để mắt nhặt ra được cảnh báo/lỗi khi lướt nhanh.
const LEVEL_ROW_BG: Record<LogLevel, string | undefined> = {
  info: undefined,
  warn: 'rgba(251,146,60,.05)',
  error: 'rgba(239,68,68,.06)'
}

/** Một dòng xuất ra tệp: `[10:02:31] ERROR app: …` */
function toLine(entry: LogEntry): string {
  return `[${formatClock(entry.at)}] ${entry.level.toUpperCase().padEnd(5)} ${entry.source}: ${entry.message}`
}

export function LogsScreen(): JSX.Element {
  const L = useDict()
  const entries = useLogStore((s) => s.entries)
  const filter = useLogStore((s) => s.filter)
  const setFilter = useLogStore((s) => s.setFilter)
  const clear = useLogStore((s) => s.clear)

  const shown = filter === 'all' ? entries : entries.filter((e) => e.level === filter)

  const filters: { value: LogFilter; label: string }[] = [
    { value: 'all', label: L.logAll },
    { value: 'info', label: L.logInfo },
    { value: 'warn', label: L.logWarn },
    { value: 'error', label: L.logError }
  ]

  return (
    <div className={`${SCREEN} min-h-0 flex-1`}>
      <ScreenHeader
        icon="terminal"
        title={L.logs}
        subtitle={L.logsSub}
        color="#94a3b8"
        tint="rgba(148,163,184,.14)"
        right={
          <div className="flex gap-2">
            {/* Xuất theo thứ tự thời gian (cũ → mới) dù màn hình xếp ngược lại:
                đọc một tệp log từ trên xuống là đọc theo dòng thời gian. */}
            <button
              className={GHOST_BUTTON}
              disabled={entries.length === 0}
              onClick={() => downloadText('llvt-log.txt', entries.map(toLine).join('\n'))}
            >
              <Icon name="download" size={14} />
              {L.logExport}
            </button>
            <button className={DANGER_BUTTON} disabled={entries.length === 0} onClick={clear}>
              {L.logClear}
            </button>
          </div>
        }
      />

      <Segmented value={filter} options={filters} onChange={setFilter} />

      <div className="cs min-h-65 flex-1 overflow-y-auto rounded-2xl border border-line bg-inset-2 p-2 font-mono backdrop-blur-xl">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2.5 px-5 py-15 font-sans text-fg-5">
            <Icon name="terminal" size={34} strokeWidth={1.4} />
            <div className="text-md">{L.logEmpty}</div>
          </div>
        ) : (
          // Mới nhất lên đầu: dòng vừa xảy ra là dòng người dùng đang đi tìm.
          shown
            .slice()
            .reverse()
            .map((entry) => (
              <div
                key={entry.id}
                className="flex items-baseline gap-3 rounded-xs px-2.5 py-1.5 text-base leading-relaxed"
                style={{ background: LEVEL_ROW_BG[entry.level] }}
              >
                <span className="shrink-0 text-fg-5">{formatClock(entry.at)}</span>
                <span
                  className="w-11 shrink-0 text-xs font-bold tracking-[0.4px]"
                  style={{ color: LEVEL_COLOR[entry.level] }}
                >
                  {entry.level.toUpperCase()}
                </span>
                <span className="truncate-1 w-18.5 shrink-0 text-fg-4">{entry.source}</span>
                <span className="min-w-0 flex-1 text-fg-2">{entry.message}</span>
              </div>
            ))
        )}
      </div>
    </div>
  )
}
