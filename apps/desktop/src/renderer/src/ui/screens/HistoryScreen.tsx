// Màn Lịch sử: danh sách cuộc họp đã ghi (lưu cục bộ) + bản ghi song ngữ của
// cuộc họp đang chọn, kèm xuất .txt/.srt.

import { useState, type JSX } from 'react'
import { downloadText, meetingToSrt, meetingToTxt } from '../../application/export'
import { formatClock, formatDateTime } from '../../application/utterances'
import { useDict } from '../../hooks/use-ui'
import { useMeetingStore } from '../../stores/meeting-store'
import { Icon } from '../components/Icon'
import { Dot, EmptyState, ScreenHeader } from '../components/primitives'
import { dangerButton, ghostButton, inputStyle, LABEL, MONO, PANEL } from '../styles'

const GRID = '64px 74px 1fr 1fr 120px'

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
    <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader
        icon="clock"
        title={L.history}
        subtitle={L.historySub}
        color="#d946ef"
        tint="rgba(217,70,239,.12)"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ ...ghostButton, opacity: selected ? 1 : 0.45 }}
              disabled={!selected}
              onClick={() =>
                selected && downloadText(`${selected.title}.txt`, meetingToTxt(selected))
              }
            >
              <Icon name="download" size={14} />
              .txt
            </button>
            <button
              style={{ ...ghostButton, opacity: selected ? 1 : 0.45 }}
              disabled={!selected}
              onClick={() =>
                selected && downloadText(`${selected.title}.srt`, meetingToSrt(selected))
              }
            >
              <Icon name="download" size={14} />
              .srt
            </button>
            <button
              style={{ ...dangerButton, opacity: meetings.length ? 1 : 0.45 }}
              disabled={meetings.length === 0}
              onClick={clearAll}
            >
              {L.clearAll}
            </button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: 14 }}>
        {/* danh sách cuộc họp */}
        <div style={{ ...PANEL, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: '11px 12px',
              borderBottom: '1px solid var(--line)',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: 9
            }}
          >
            <span style={LABEL}>{L.meetingsTitle}</span>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text4)',
                  display: 'flex'
                }}
              >
                <Icon name="search" size={14} />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={L.searchHistory}
                style={{ ...inputStyle, height: 34, fontSize: 12, paddingLeft: 32 }}
              />
            </div>
          </div>

          <div
            className="cs"
            style={{
              maxHeight: 476,
              overflowY: 'auto',
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            {meetings.length === 0 && (
              <div
                style={{
                  padding: '26px 16px',
                  textAlign: 'center',
                  color: 'var(--text5)',
                  fontSize: 12,
                  lineHeight: 1.5
                }}
              >
                {L.startToRec}
              </div>
            )}
            {meetings.length > 0 && filtered.length === 0 && (
              <div style={{ padding: '30px 16px', textAlign: 'center' }}>
                <Icon name="search" size={26} strokeWidth={1.6} />
                <div
                  style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text3)', marginTop: 8 }}
                >
                  {L.noResultsT}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text5)', marginTop: 4, lineHeight: 1.5 }}>
                  {L.noResultsS}
                </div>
              </div>
            )}

            {filtered.map((m) => {
              const isSelected = m.id === selected?.id
              const isRecording = m.id === currentId
              return (
                <div
                  key={m.id}
                  onClick={() => select(m.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    transition: 'all .15s',
                    border: `1px solid ${isSelected ? 'rgba(240,171,252,.4)' : 'var(--line)'}`,
                    background: isSelected ? 'rgba(240,171,252,.08)' : 'var(--surface)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                        style={{
                          ...inputStyle,
                          flex: 1,
                          minWidth: 0,
                          height: 26,
                          padding: '0 8px',
                          fontSize: 12.5,
                          fontWeight: 700,
                          borderColor: 'var(--ac-mag)',
                          ...MONO
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: isSelected ? 'var(--text)' : 'var(--text2)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          ...MONO
                        }}
                      >
                        {m.title}
                      </span>
                    )}
                    {isRecording && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 8.5,
                          fontWeight: 800,
                          letterSpacing: 0.5,
                          padding: '2px 7px',
                          borderRadius: 9999,
                          color: 'var(--ac-red)',
                          background: 'rgba(239,68,68,.14)',
                          border: '1px solid rgba(239,68,68,.35)'
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#ef4444',
                            animation: 'blink 1s step-start infinite'
                          }}
                        />
                        REC
                      </span>
                    )}
                    <button
                      className="iconbtn"
                      title={L.renameTip}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDraftTitle(m.title)
                        setEditing(m.id)
                      }}
                      style={{
                        width: 24,
                        height: 24,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 6,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text4)',
                        cursor: 'pointer'
                      }}
                    >
                      <Icon name="pencil" size={13} />
                    </button>
                    <button
                      className="dangerbtn"
                      title={L.deleteTip}
                      onClick={(e) => {
                        e.stopPropagation()
                        remove(m.id)
                      }}
                      style={{
                        width: 24,
                        height: 24,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 6,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text4)',
                        cursor: 'pointer'
                      }}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 10.5,
                      color: 'var(--text4)'
                    }}
                  >
                    <span>{formatDateTime(m.startedAtMs)}</span>
                    <span style={{ opacity: 0.4 }}>·</span>
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
        <div style={{ ...PANEL, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {selected ? (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 18px',
                  borderBottom: '1px solid var(--line)',
                  background: 'var(--surface)'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, ...MONO }}>{selected.title}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text4)', marginTop: 2 }}>
                    {formatDateTime(selected.startedAtMs)}
                  </div>
                </div>
                {selected.id === currentId && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: 0.5,
                      padding: '3px 9px',
                      borderRadius: 9999,
                      color: 'var(--ac-red)',
                      background: 'rgba(239,68,68,.14)',
                      border: '1px solid rgba(239,68,68,.35)'
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#ef4444',
                        animation: 'blink 1s step-start infinite'
                      }}
                    />
                    {L.recording}
                  </span>
                )}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: GRID,
                  gap: 12,
                  padding: '9px 18px',
                  borderBottom: '1px solid var(--line-soft)',
                  ...LABEL,
                  fontSize: 9.5
                }}
              >
                <span>{L.colTime}</span>
                <span>{L.colSrc}</span>
                <span>{L.colOriginal}</span>
                <span>{L.colTranslated}</span>
                <span style={{ textAlign: 'right' }}>{L.colLatency}</span>
              </div>
              <div className="cs" style={{ maxHeight: 472, overflowY: 'auto' }}>
                {rows.length === 0 ? (
                  <div
                    style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: 'var(--text5)',
                      fontSize: 12.5
                    }}
                  >
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
                        style={{
                          display: 'grid',
                          gridTemplateColumns: GRID,
                          gap: 12,
                          padding: '12px 18px',
                          borderBottom: '1px solid var(--line-soft)',
                          alignItems: 'center',
                          animation: 'fadeup .3s ease'
                        }}
                      >
                        <span style={{ fontSize: 11, color: 'var(--text4)', ...MONO }}>
                          {formatClock(row.atMs)}
                        </span>
                        <span
                          style={{
                            justifySelf: 'start',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: 0.4,
                            padding: '2px 8px',
                            borderRadius: 9999,
                            color,
                            background: `${color}1f`,
                            border: `1px solid ${color}4d`
                          }}
                        >
                          <Dot color={color} size={5} glow={false} />
                          {row.side === 'me' ? 'ME' : 'REMOTE'}
                        </span>
                        <span style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.4 }}>
                          {row.sourceText}
                        </span>
                        <span
                          style={{
                            fontSize: 12.5,
                            color: 'var(--text2)',
                            fontWeight: 500,
                            lineHeight: 1.4
                          }}
                        >
                          {row.translatedText}
                        </span>
                        <span
                          style={{
                            textAlign: 'right',
                            fontSize: 10.5,
                            color: 'var(--text4)',
                            ...MONO
                          }}
                        >
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
