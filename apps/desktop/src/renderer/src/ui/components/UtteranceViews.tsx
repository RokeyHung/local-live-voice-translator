// Cách vẽ một câu trên màn Phiên dịch — bố cục duy nhất, dòng thời gian của cuộc họp.
//
// Màu theo bên phát (cuộc họp tím / mình xanh) và màu theo trạng thái pipeline đều
// tính lúc chạy nên đi qua `style`; bố cục và cỡ chữ là class Tailwind.

import type { JSX } from 'react'
import type { Dict } from '../../application/i18n'
import { languageShort } from '../../application/i18n'
import { bubbleLines } from '../../application/meeting'
import { formatClock } from '../../application/utterances'
import type { Side } from '../../domain/enums'
import { SIDE_COLOR, statusMeta, type ViewUtterance } from '../utterance-view'
import { Badge } from './primitives'

function SideTag({ side, L }: { side: Side; L: Dict }): JSX.Element {
  const color = SIDE_COLOR[side]
  return (
    <span
      className="rounded-xs px-2 py-0.5 text-xs font-extrabold tracking-[0.5px] uppercase"
      style={{ color, background: `${color}1a` }}
    >
      {side === 'me' ? L.sideMe : L.sideMeeting}
    </span>
  )
}

function Shell({
  side,
  header,
  children
}: {
  side: Side
  header: JSX.Element
  children: JSX.Element | JSX.Element[]
}): JSX.Element {
  const isMe = side === 'me'
  const tag = SIDE_COLOR[side]
  return (
    <div
      className={`flex motion-safe:animate-[fadeup_.3s_ease] ${isMe ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className="max-w-[78%] rounded-xl border px-4 py-3.25"
        style={{
          borderColor: `${tag}33`,
          background: isMe ? 'rgba(34,211,238,.06)' : 'rgba(217,70,239,.06)'
        }}
      >
        <div className={`mb-1.5 flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
          {header}
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * Một câu đã nhận dạng xong. Chữ to luôn là NGÔN NGỮ CỦA MÌNH (xem `bubbleLines`):
 * câu của cuộc họp in bản dịch to, câu gốc nhỏ để đối chiếu; câu của mình in câu gốc
 * to, bản dịch sang ngôn ngữ cuộc họp nhỏ bên dưới.
 */
export function MeetingBubble({ u, L }: { u: ViewUtterance; L: Dict }): JSX.Element {
  const status = statusMeta(u.state, L)
  const lines = bubbleLines(u.side, u.sourceText ?? '', u.displayTarget)
  const done = u.state === 'Completed'

  return (
    <Shell
      side={u.side}
      header={
        <>
          <SideTag side={u.side} L={L} />
          <span className="font-mono text-[10px] text-fg-4">
            {u.sourceLanguage && u.targetLanguage
              ? `${languageShort(u.sourceLanguage)} → ${languageShort(u.targetLanguage)} · `
              : ''}
            {formatClock(u.at)}
          </span>
          {/* Xong rồi thì bỏ nhãn: nhãn "Hoàn tất" lặp lại ở mọi câu chỉ là nhiễu. */}
          {!done && <Badge color={status.color}>{status.text}</Badge>}
        </>
      }
    >
      {/* VAD vừa cắt câu, ASR chưa trả chữ: service báo Recognizing trước khi có text.
          Không có nhận dạng kiểu streaming nên đây là chỗ sớm nhất biết có câu mới. */}
      {lines.primary ? (
        <div
          className={`text-[16px] leading-normal font-semibold ${lines.pending ? 'text-fg-3' : 'text-fg'}`}
        >
          {lines.primary}
        </div>
      ) : (
        <div className="text-md text-fg-4 italic">{L.recognizingNow}</div>
      )}
      {lines.secondary ? (
        <div className="mt-1 text-md leading-normal text-fg-3">
          {u.side === 'me' ? `→ ${lines.secondary}` : lines.secondary}
        </div>
      ) : (
        <></>
      )}
    </Shell>
  )
}
