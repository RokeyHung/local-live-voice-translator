// Cách hiển thị một câu dịch, dùng chung cho 3 bố cục của màn Phiên dịch.
//
// Màu theo bên phát (ME xanh / REMOTE tím) và màu theo trạng thái pipeline đều
// tính lúc chạy nên đi qua `style`; bố cục và cỡ chữ là class Tailwind.

import type { JSX } from 'react'
import type { Dict } from '../../application/i18n'
import { languageShort } from '../../application/i18n'
import { formatClock } from '../../application/utterances'
import { SIDE_COLOR, statusMeta, type ViewUtterance } from '../utterance-view'
import { Badge } from './primitives'

function directionText(u: ViewUtterance): string {
  if (!u.sourceLanguage || !u.targetLanguage) return ''
  return `${languageShort(u.sourceLanguage)} → ${languageShort(u.targetLanguage)}`
}

function SideTag({ side }: { side: ViewUtterance['side'] }): JSX.Element {
  const color = SIDE_COLOR[side]
  return (
    <span
      className="rounded-xs px-2 py-0.5 text-xs font-extrabold tracking-[0.5px]"
      style={{ color, background: `${color}1a` }}
    >
      {side === 'me' ? 'Me' : 'Remote'}
    </span>
  )
}

// Dạng dòng đơn giản dùng trong hai cột Split.
export function UtteranceRow({ u, L }: { u: ViewUtterance; L: Dict }): JSX.Element {
  const status = statusMeta(u.state, L)
  return (
    <div className="motion-safe:animate-[fadeup_.3s_ease]">
      <div className="mb-1.25 flex items-center gap-2">
        <span className="font-mono text-[10px] text-fg-4">{formatClock(u.at)}</span>
        <Badge color={status.color}>{status.text}</Badge>
      </div>
      <div className="text-[14px] leading-normal text-fg-2">{u.sourceText}</div>
      {u.displayTarget && (
        <div className="mt-0.75 text-lg leading-normal font-semibold text-fg">
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

  return (
    <div
      className={`flex motion-safe:animate-[fadeup_.3s_ease] ${isMe ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className="max-w-[76%] rounded-xl border px-4 py-3.25"
        style={{
          borderColor: `${tag}33`,
          background: isMe ? 'rgba(34,211,238,.06)' : 'rgba(217,70,239,.06)'
        }}
      >
        <div className={`mb-1.5 flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
          <SideTag side={u.side} />
          <span className="font-mono text-[10px] text-fg-4">
            {directionText(u)} · {formatClock(u.at)}
          </span>
          <Badge color={status.color}>{status.text}</Badge>
        </div>
        <div className="text-md leading-normal text-fg-3">{u.sourceText}</div>
        {u.displayTarget && (
          <div className="mt-1 text-[15.5px] leading-normal font-semibold text-fg">
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
  return (
    <>
      <div className="mb-4.5 flex items-center gap-2.5">
        <SideTag side={u.side} />
        <span className="font-mono text-sm text-fg-3">{directionText(u)}</span>
        <Badge color={status.color}>{status.text}</Badge>
      </div>
      <div className="text-[19px] leading-snug font-medium text-fg-3">{u.sourceText}</div>
      {u.displayTarget && (
        <div className="mt-3.5 text-[32px] leading-tight font-extrabold tracking-[-0.5px] text-pretty text-fg">
          {u.displayTarget}
        </div>
      )}
    </>
  )
}
