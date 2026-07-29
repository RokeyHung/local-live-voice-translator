// Dải nhắc khôi phục: hiện khi lần chạy trước bị đóng giữa lúc đang ghi, để lại
// một cuộc họp chưa được đóng nhưng đã có câu dịch.

import type { JSX } from 'react'
import { useDict } from '../../hooks/use-ui'
import { useMeetingStore } from '../../stores/meeting-store'
import { useUiStore } from '../../stores/ui-store'
import { Icon } from '../components/Icon'
import { MONO } from '../styles'

export function RecoveryBanner(): JSX.Element | null {
  const L = useDict()
  const recoverableId = useMeetingStore((s) => s.recoverableId)
  const meetings = useMeetingStore((s) => s.meetings)
  const resolveRecovery = useMeetingStore((s) => s.resolveRecovery)
  const setScreen = useUiStore((s) => s.setScreen)

  const meeting = meetings.find((m) => m.id === recoverableId)
  if (!meeting) return null

  return (
    <div
      style={{
        margin: '16px 26px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '13px 16px',
        borderRadius: 14,
        border: '1px solid rgba(251,146,60,.32)',
        background: 'rgba(251,146,60,.09)'
      }}
    >
      <span style={{ color: '#fb923c', display: 'flex' }}>
        <Icon name="refresh" size={19} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ac-org2)' }}>{L.recoverT}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ac-org)', marginTop: 2 }}>
          {L.recoverS} <span style={{ fontWeight: 600, ...MONO }}>{meeting.title}</span> (
          {meeting.rows.length} {L.utter})
        </div>
      </div>
      <button
        onClick={() => {
          resolveRecovery(true)
          setScreen('history')
        }}
        style={{
          height: 32,
          padding: '0 15px',
          borderRadius: 9,
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          color: '#04121a',
          background: 'linear-gradient(135deg,#fb923c,#f59e0b)',
          border: 'none'
        }}
      >
        {L.recoverBtn}
      </button>
      <button
        onClick={() => resolveRecovery(false)}
        style={{
          height: 32,
          padding: '0 13px',
          borderRadius: 9,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          color: 'var(--text3)',
          background: 'transparent',
          border: '1px solid var(--line-strong)'
        }}
      >
        {L.recoverDismiss}
      </button>
    </div>
  )
}
