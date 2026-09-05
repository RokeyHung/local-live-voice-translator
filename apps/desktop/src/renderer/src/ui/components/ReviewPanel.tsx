// Ô "duyệt trước khi gửi" (SPEC 7.10 `Review before speaking`).
//
// Bật tuỳ chọn này thì service dừng chiều outgoing sau khâu dịch và báo trạng thái
// `WaitingForConfirmation`. Câu nằm ở đây cho tới khi người dùng bấm Gửi hoặc Bỏ —
// **chưa có gì phát ra micro ảo**, nên đây là chỗ duy nhất họ còn sửa được.
//
// Đếm ngược (SPEC 7.8) là để chế độ này vẫn dùng được khi đang họp thật: không ai
// bấm thì câu tự gửi sau vài giây. Gõ vào ô sửa sẽ **huỷ** đếm ngược — đang sửa dở
// mà câu tự bay đi là hỏng việc, mà đó lại đúng lúc người dùng cần nó nhất.

import { useEffect, useRef, useState, type JSX } from 'react'
import type { Dict } from '../../application/i18n'
import { DANGER_BUTTON, INPUT, PRIMARY_BUTTON } from '../styles'
import { Icon } from './Icon'
import { Meter } from './primitives'

export interface ReviewItem {
  id: string
  sourceText: string
  draft: string
}

function ReviewCard({
  item,
  countdownSec,
  onEdit,
  onSend,
  onDiscard,
  L
}: {
  item: ReviewItem
  countdownSec: number
  onEdit: (text: string) => void
  onSend: () => void
  onDiscard: () => void
  L: Dict
}): JSX.Element {
  // null = không đếm (đã tắt trong Cài đặt, hoặc người dùng vừa gõ nên đã huỷ).
  const [remaining, setRemaining] = useState<number | null>(countdownSec > 0 ? countdownSec : null)
  // Giữ callback trong ref: đồng hồ chỉ phụ thuộc số giây còn lại, còn `onSend` thì
  // đổi mỗi lần render — để nó vào deps sẽ khởi động lại đồng hồ liên tục và không
  // bao giờ đếm hết. Gán trong effect chứ không gán thẳng lúc render (React 19 cấm
  // ghi ref trong thân component).
  const sendRef = useRef(onSend)
  useEffect(() => {
    sendRef.current = onSend
  }, [onSend])

  useEffect(() => {
    if (remaining === null) return
    if (remaining <= 0) {
      sendRef.current()
      return
    }
    const timer = window.setTimeout(() => setRemaining((n) => (n === null ? null : n - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [remaining])

  const edit = (text: string): void => {
    setRemaining(null) // đang sửa thì không được tự gửi
    onEdit(text)
  }

  const counting = remaining !== null && countdownSec > 0

  return (
    <div
      className="rounded-xl border px-4 py-3.5"
      style={{ borderColor: 'rgba(251,191,36,.35)', background: 'rgba(251,191,36,.07)' }}
    >
      <div className="flex items-center gap-2">
        <span className="flex text-[#fbbf24]">
          <Icon name="pencil" size={15} />
        </span>
        <span className="text-base font-bold text-[#fbbf24]">{L.reviewTitle}</span>
        {counting && (
          <span className="ml-auto font-mono text-sm font-bold text-[#fbbf24]">
            {L.reviewAutoIn} {remaining}s
          </span>
        )}
      </div>

      {/* Câu gốc để đối chiếu — sửa bản dịch mà không thấy mình đã nói gì thì khó. */}
      {item.sourceText && (
        <div className="mt-2 truncate-2 text-sm text-fg-4">{item.sourceText}</div>
      )}

      <textarea
        value={item.draft}
        onChange={(e) => edit(e.target.value)}
        rows={2}
        autoFocus
        onKeyDown={(e) => {
          // Enter gửi, Shift+Enter xuống dòng — quy ước quen thuộc của ô chat, và
          // lúc đang họp thì bỏ được một lần với chuột là đáng.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSend()
          }
          if (e.key === 'Escape') onDiscard()
        }}
        className={`${INPUT} mt-2 h-auto w-full resize-y py-2 leading-snug`}
      />

      {counting && (
        <div className="mt-2 flex">
          <Meter value={(remaining ?? 0) / countdownSec} color="#fbbf24" height={4} />
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        <button className={PRIMARY_BUTTON} onClick={onSend} disabled={!item.draft.trim()}>
          <Icon name="play" size={13} />
          {L.reviewSend}
        </button>
        <button className={DANGER_BUTTON} onClick={onDiscard}>
          <Icon name="x" size={12} strokeWidth={2.4} />
          {L.reviewDiscard}
        </button>
        <span className="ml-auto text-xs text-fg-5">{L.reviewHint}</span>
      </div>
    </div>
  )
}

export function ReviewPanel({
  items,
  countdownSec,
  onEdit,
  onSend,
  onDiscard,
  L
}: {
  items: ReviewItem[]
  countdownSec: number
  onEdit: (id: string, text: string) => void
  onSend: (id: string) => void
  onDiscard: (id: string) => void
  L: Dict
}): JSX.Element | null {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        // `key` là id câu nên mỗi câu có timer riêng, và câu mới không thừa hưởng
        // đồng hồ đang chạy dở của câu trước.
        <ReviewCard
          key={item.id}
          item={item}
          countdownSec={countdownSec}
          onEdit={(text) => onEdit(item.id, text)}
          onSend={() => onSend(item.id)}
          onDiscard={() => onDiscard(item.id)}
          L={L}
        />
      ))}
    </div>
  )
}
