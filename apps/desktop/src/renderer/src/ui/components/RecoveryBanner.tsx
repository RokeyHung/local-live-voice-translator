// Dải nhắc khôi phục: hiện khi lần chạy trước bị đóng giữa lúc đang ghi.
//
// Service ghi mốc kết thúc của phiên khi nhận `session.stop`, nên một phiên đã có câu
// mà `endedAtMs` vẫn rỗng (và không phải phiên đang chạy) chính là phiên bị bỏ dở.

import type { JSX } from 'react'
import { useCloseSession, useSessions } from '../../hooks/use-history'
import { useDict } from '../../hooks/use-ui'
import { useSessionStore } from '../../stores/session-store'
import { useUiStore } from '../../stores/ui-store'
import { Icon } from '../components/Icon'

export function RecoveryBanner(): JSX.Element | null {
  const L = useDict()
  const setScreen = useUiStore((s) => s.setScreen)
  const active = useSessionStore((s) => s.active)
  const currentId = useSessionStore((s) => s.historySessionId)
  // Trả lời rồi thì đóng phiên lại bên service → lần mở app sau không hỏi nữa.
  const close = useCloseSession()

  const { data } = useSessions('', active)
  const orphan = (data ?? []).find(
    (s) => s.endedAtMs == null && s.utteranceCount > 0 && s.id !== currentId
  )
  if (!orphan) return null

  return (
    <div className="mx-6.5 mt-4 flex items-center gap-3.25 rounded-xl border border-[rgba(251,146,60,.32)] bg-[rgba(251,146,60,.09)] px-4 py-3.25">
      <span className="flex text-[#fb923c]">
        <Icon name="refresh" size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-base font-bold text-ac-org-2">{L.recoverT}</div>
        <div className="mt-0.5 text-sm text-ac-org">
          {L.recoverS} <span className="font-mono font-semibold">{orphan.title}</span> (
          {orphan.utteranceCount} {L.utter})
        </div>
      </div>
      <button
        onClick={() => {
          close.mutate(orphan.id)
          setScreen('history')
        }}
        className="h-8 cursor-pointer rounded-[9px] border-none bg-linear-[135deg,#fb923c,#f59e0b] px-3.75 text-sm font-bold text-[#04121a]"
      >
        {L.recoverBtn}
      </button>
      <button
        onClick={() => close.mutate(orphan.id)}
        className="h-8 cursor-pointer rounded-[9px] border border-line-strong bg-transparent px-3.25 text-sm font-semibold text-fg-3 hover:text-fg-2"
      >
        {L.recoverDismiss}
      </button>
    </div>
  )
}
