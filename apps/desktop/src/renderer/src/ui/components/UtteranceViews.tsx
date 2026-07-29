// Cách hiển thị một câu dịch, dùng chung cho 3 bố cục của màn Phiên dịch.

import type { CSSProperties, JSX } from 'react'
import type { Dict } from '../../application/i18n'
import { languageShort } from '../../application/i18n'
import { formatClock } from '../../application/utterances'
import { SIDE_COLOR, statusMeta, type ViewUtterance } from '../utterance-view'
import { Badge } from './primitives'

function directionText(u: ViewUtterance): string {
  if (!u.sourceLanguage || !u.targetLanguage) return ''
  return `${languageShort(u.sourceLanguage)} → ${languageShort(u.targetLanguage)}`
}

// Dạng dòng đơn giản dùng trong hai cột Split.
export function UtteranceRow({ u, L }: { u: ViewUtterance; L: Dict }): JSX.Element {
  const status = statusMeta(u.state, L)
  return (
    <div style={{ animation: 'fadeup .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: 'var(--text4)', fontFamily: 'var(--font-mono)' }}>
          {formatClock(u.at)}
        </span>
        <Badge color={status.color}>{status.text}</Badge>
      </div>
      <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>{u.sourceText}</div>
      {u.displayTarget && (
        <div
          style={{
            fontSize: 15,
            color: 'var(--text)',
            fontWeight: 600,
            lineHeight: 1.5,
            marginTop: 3
          }}
        >
          {u.displayTarget}
        </div>
      )}
    </div>
  )
}

// Dạng bong bóng hai phía dùng trong Timeline.
export function UtteranceBubble({ u, L }: { u: ViewUtterance; L: Dict }): JSX.Element {
  const status = statusMeta(u.state, L)
  const isMe = u.side === 'me'
  const tag = SIDE_COLOR[u.side]
  const tagStyle: CSSProperties = {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.5,
    padding: '2px 8px',
    borderRadius: 6,
    color: tag,
    background: `${tag}1a`
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isMe ? 'flex-end' : 'flex-start',
        animation: 'fadeup .3s ease'
      }}
    >
      <div
        style={{
          maxWidth: '76%',
          padding: '13px 16px',
          borderRadius: 14,
          border: `1px solid ${tag}33`,
          background: isMe ? 'rgba(34,211,238,.06)' : 'rgba(217,70,239,.06)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
            flexDirection: isMe ? 'row-reverse' : 'row'
          }}
        >
          <span style={tagStyle}>{isMe ? 'Me' : 'Remote'}</span>
          <span style={{ fontSize: 10, color: 'var(--text4)', fontFamily: 'var(--font-mono)' }}>
            {directionText(u)} · {formatClock(u.at)}
          </span>
          <Badge color={status.color}>{status.text}</Badge>
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text3)', lineHeight: 1.5 }}>{u.sourceText}</div>
        {u.displayTarget && (
          <div
            style={{
              fontSize: 15.5,
              color: 'var(--text)',
              fontWeight: 600,
              lineHeight: 1.5,
              marginTop: 4
            }}
          >
            {u.displayTarget}
          </div>
        )}
      </div>
    </div>
  )
}

// Câu mới nhất, cỡ chữ lớn — bố cục Focus.
export function UtteranceFocus({ u, L }: { u: ViewUtterance; L: Dict }): JSX.Element {
  const status = statusMeta(u.state, L)
  const tag = SIDE_COLOR[u.side]
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.5,
            padding: '2px 8px',
            borderRadius: 6,
            color: tag,
            background: `${tag}1a`
          }}
        >
          {u.side === 'me' ? 'Me' : 'Remote'}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
          {directionText(u)}
        </span>
        <Badge color={status.color}>{status.text}</Badge>
      </div>
      <div style={{ fontSize: 19, color: 'var(--text3)', lineHeight: 1.45, fontWeight: 500 }}>
        {u.sourceText}
      </div>
      {u.displayTarget && (
        <div
          style={{
            fontSize: 32,
            color: 'var(--text)',
            fontWeight: 800,
            lineHeight: 1.28,
            marginTop: 14,
            letterSpacing: -0.5,
            textWrap: 'pretty'
          }}
        >
          {u.displayTarget}
        </div>
      )}
    </>
  )
}
