// Dải nhắc khôi phục: hiện khi lần chạy trước bị đóng giữa lúc đang ghi, để lại
// một cuộc họp chưa được đóng nhưng đã có câu dịch.

import type { JSX } from 'react'
import { useDict } from '../../hooks/use-ui'
import { useMeetingStore } from '../../stores/meeting-store'
import { useUiStore } from '../../stores/ui-store'
import { Icon } from '../components/Icon'

export function RecoveryBanner(): JSX.Element | null {
  const L = useDict()
  const recoverableId = useMeetingStore((s) => s.recoverableId)
  const meetings = useMeetingStore((s) => s.meetings)
  const resolveRecovery = useMeetingStore((s) => s.resolveRecovery)
  const setScreen = useUiStore((s) => s.setScreen)

  const meeting = meetings.find((m) => m.id === recoverableId)
  if (!meeting) return null

  return (
    <div className="mx-6.5 mt-4 flex items-center gap-3.25 rounded-xl border border-[rgba(251,146,60,.32)] bg-[rgba(251,146,60,.09)] px-4 py-3.25">
      <span className="flex text-[#fb923c]">
        <Icon name="refresh" size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-base font-bold text-ac-org-2">{L.recoverT}</div>
        <div className="mt-0.5 text-sm text-ac-org">
          {L.recoverS} <span className="font-mono font-semibold">{meeting.title}</span> (
          {meeting.rows.length} {L.utter})
        </div>
      </div>
      <button
        onClick={() => {
          resolveRecovery(true)
          setScreen('history')
        }}
        className="h-8 cursor-pointer rounded-[9px] border-none bg-linear-[135deg,#fb923c,#f59e0b] px-3.75 text-sm font-bold text-[#04121a]"
      >
        {L.recoverBtn}
      </button>
      <button
        onClick={() => resolveRecovery(false)}
        className="h-8 cursor-pointer rounded-[9px] border border-line-strong bg-transparent px-3.25 text-sm font-semibold text-fg-3 hover:text-fg-2"
      >
        {L.recoverDismiss}
      </button>
    </div>
  )
}
