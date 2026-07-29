// Màn Lịch sử: danh sách cuộc họp đã ghi (lưu cục bộ) + bản ghi song ngữ của
// cuộc họp đang chọn, kèm xuất .txt/.srt.

import { useState, type JSX } from 'react'
import { downloadText, meetingToSrt, meetingToTxt } from '../../application/export'
import { formatClock, formatDateTime } from '../../application/utterances'
import { useDict } from '../../hooks/use-ui'
import { useMeetingStore } from '../../stores/meeting-store'
import { Icon } from '../components/Icon'
import { Dot, EmptyState, ScreenHeader } from '../components/primitives'
import { DANGER_BUTTON, GHOST_BUTTON, ICON_BUTTON, INPUT, SCREEN } from '../styles'

// Cùng một lưới cho hàng tiêu đề và các dòng bản ghi.
const GRID = 'grid grid-cols-[64px_74px_1fr_1fr_120px] gap-3'

const REC_BADGE =
  'inline-flex items-center gap-1.25 rounded-full border border-[rgba(239,68,68,.35)] bg-[rgba(239,68,68,.14)] text-ac-red font-extrabold tracking-[0.5px]'

export function HistoryScreen(): JSX.Element {
  const L = useDict()
  const meetings = useMeetingStore((s) => s.meetings)
  const selectedId = useMeetingStore((s) => s.selectedId)
  const currentId = useMeetingStore((s) => s.currentId)
  const query = useMeetingStore((s) => s.query)
  const editingId = useMeetingStore((s) => s.editingId)
  const select = useMeetingStore((s) => s.select)
  const rename = useMeetingStore((s) => s.rename)
  const remove = useMeetingStore((s) => s.remove)
  const clearAll = useMeetingStore((s) => s.clearAll)
  const setQuery = useMeetingStore((s) => s.setQuery)
  const setEditing = useMeetingStore((s) => s.setEditing)
  const [draftTitle, setDraftTitle] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q
    ? meetings.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.rows.some((r) => `${r.sourceText} ${r.translatedText}`.toLowerCase().includes(q))
      )
    : meetings

  const selected = meetings.find((m) => m.id === selectedId) ?? meetings[0] ?? null
  const rows = selected?.rows ?? []

  return (
    <div className={SCREEN}>
      <ScreenHeader
        icon="clock"
        title={L.history}
        subtitle={L.historySub}
        color="#d946ef"
        tint="rgba(217,70,239,.12)"
        right={
          <div className="flex gap-2">
            <button
              className={GHOST_BUTTON}
              disabled={!selected}
              onClick={() =>
                selected && downloadText(`${selected.title}.txt`, meetingToTxt(selected))
              }
            >
              <Icon name="download" size={14} />
              .txt
            </button>
            <button
              className={GHOST_BUTTON}
              disabled={!selected}
              onClick={() =>
                selected && downloadText(`${selected.title}.srt`, meetingToSrt(selected))
              }
            >
              <Icon name="download" size={14} />
              .srt
            </button>
            <button className={DANGER_BUTTON} disabled={meetings.length === 0} onClick={clearAll}>
              {L.clearAll}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-[270px_1fr] gap-3.5">
        {/* danh sách cuộc họp */}
        <div className="panel flex flex-col overflow-hidden">
          <div className="flex flex-col gap-2.25 border-b border-line bg-surface px-3 py-2.75">
            <span className="label-caps">{L.meetingsTitle}</span>
            <div className="relative">
              <span className="absolute top-1/2 left-2.5 flex -translate-y-1/2 text-fg-4">
                <Icon name="search" size={14} />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={L.searchHistory}
                className={`${INPUT} h-8.5 pl-8 text-sm`}
              />
            </div>
          </div>

          <div className="cs flex max-h-119 flex-col gap-2 overflow-y-auto p-2.5">
            {meetings.length === 0 && (
              <div className="px-4 py-6.5 text-center text-sm leading-normal text-fg-5">
                {L.startToRec}
              </div>
            )}
            {meetings.length > 0 && filtered.length === 0 && (
              <div className="px-4 py-7.5 text-center">
                <Icon name="search" size={26} strokeWidth={1.6} />
                <div className="mt-2 text-base font-semibold text-fg-3">{L.noResultsT}</div>
                <div className="mt-1 text-sm leading-normal text-fg-5">{L.noResultsS}</div>
              </div>
            )}

            {filtered.map((m) => {
              const isSelected = m.id === selected?.id
              const isRecording = m.id === currentId
              return (
                <div
                  key={m.id}
                  onClick={() => select(m.id)}
                  className={[
                    'flex w-full cursor-pointer flex-col gap-1.25 rounded-lg border px-3.5 py-3 text-left transition-all',
                    isSelected
                      ? 'border-[rgba(240,171,252,.4)] bg-[rgba(240,171,252,.08)]'
                      : 'border-line bg-surface hover:border-line-strong'
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    {editingId === m.id ? (
                      <input
                        autoFocus
                        value={draftTitle}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onBlur={() => rename(m.id, draftTitle)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') rename(m.id, draftTitle)
                          if (e.key === 'Escape') setEditing(null)
                        }}
                        className={`${INPUT} h-6.5 min-w-0 flex-1 border-ac-mag px-2 font-mono text-base font-bold`}
                      />
                    ) : (
                      <span
                        className={`truncate-1 min-w-0 flex-1 font-mono text-base font-bold ${
                          isSelected ? 'text-fg' : 'text-fg-2'
                        }`}
                      >
                        {m.title}
                      </span>
                    )}
                    {isRecording && (
                      <span className={`${REC_BADGE} px-1.75 py-0.5 text-[8.5px]`}>
                        <span className="size-1.5 rounded-full bg-[#ef4444] motion-safe:animate-[blink_1s_step-start_infinite]" />
                        REC
                      </span>
                    )}
                    <button
                      title={L.renameTip}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDraftTitle(m.title)
                        setEditing(m.id)
                      }}
                      className={`${ICON_BUTTON} hover:bg-[rgba(217,70,239,.1)] hover:text-ac-mag`}
                    >
                      <Icon name="pencil" size={13} />
                    </button>
                    <button
                      title={L.deleteTip}
                      onClick={(e) => {
                        e.stopPropagation()
                        remove(m.id)
                      }}
                      className={`${ICON_BUTTON} hover:bg-[rgba(239,68,68,.1)] hover:text-[#f87171]`}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-fg-4">
                    <span>{formatDateTime(m.startedAtMs)}</span>
                    <span className="opacity-40">·</span>
                    <span>
                      {m.rows.length} {L.utter}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* bản ghi */}
        <div className="panel flex flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="flex items-center gap-2.5 border-b border-line bg-surface px-4.5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-md font-bold">{selected.title}</div>
                  <div className="mt-0.5 text-xs text-fg-4">
                    {formatDateTime(selected.startedAtMs)}
                  </div>
                </div>
                {selected.id === currentId && (
                  <span className={`${REC_BADGE} px-2.25 py-0.75 text-3xs`}>
                    <span className="size-1.5 rounded-full bg-[#ef4444] motion-safe:animate-[blink_1s_step-start_infinite]" />
                    {L.recording}
                  </span>
                )}
              </div>
              <div className={`${GRID} label-caps border-b border-line-soft px-4.5 py-2.25`}>
                <span>{L.colTime}</span>
                <span>{L.colSrc}</span>
                <span>{L.colOriginal}</span>
                <span>{L.colTranslated}</span>
                <span className="text-right">{L.colLatency}</span>
              </div>
              <div className="cs max-h-118 overflow-y-auto">
                {rows.length === 0 ? (
                  <div className="px-5 py-10 text-center text-base text-fg-5">
                    {L.emptyTranscript}
                  </div>
                ) : (
                  rows.map((row) => {
                    const color = row.side === 'me' ? '#22d3ee' : '#d946ef'
                    const latency = [row.asrMs, row.mtMs, row.ttsMs]
                      .filter((v): v is number => v != null)
                      .join('·')
                    return (
                      <div
                        key={row.id}
                        className={`${GRID} items-center border-b border-line-soft px-4.5 py-3 motion-safe:animate-[fadeup_.3s_ease]`}
                      >
                        <span className="font-mono text-sm text-fg-4">{formatClock(row.atMs)}</span>
                        <span
                          className="inline-flex items-center gap-1.25 justify-self-start rounded-full border px-2 py-0.5 text-3xs font-bold tracking-[0.4px]"
                          style={{
                            color,
                            background: `${color}1f`,
                            borderColor: `${color}4d`
                          }}
                        >
                          <Dot color={color} size={5} glow={false} />
                          {row.side === 'me' ? 'ME' : 'REMOTE'}
                        </span>
                        <span className="text-base leading-snug text-fg-3">{row.sourceText}</span>
                        <span className="text-base leading-snug font-medium text-fg-2">
                          {row.translatedText}
                        </span>
                        <span className="text-right font-mono text-xs text-fg-4">
                          {latency ? `${latency}ms` : '—'}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </>
          ) : (
            <EmptyState icon="clock" title={L.startToRec} minHeight={300} />
          )}
        </div>
      </div>
    </div>
  )
}
