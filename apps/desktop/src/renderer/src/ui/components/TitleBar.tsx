// Thanh tiêu đề của cửa sổ. Trên macOS nút đèn giao thông thật của hệ điều hành
// nằm chồng lên thanh này (titleBarStyle: 'hiddenInset') nên chừa lề trái; toàn
// thanh là vùng kéo cửa sổ, riêng phần chỉ báo thì không.

import type { JSX } from 'react'
import { PLATFORM } from '../../application/config'
import { useDict } from '../../hooks/use-ui'
import { Dot } from './primitives'

export function TitleBar({ offlineReady }: { offlineReady: boolean }): JSX.Element {
  const L = useDict()
  const isMac = PLATFORM === 'darwin'

  return (
    <div
      style={
        {
          height: 44,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: isMac ? '0 16px 0 84px' : '0 16px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--inset)',
          backdropFilter: 'blur(20px)',
          WebkitAppRegion: 'drag'
        } as React.CSSProperties
      }
    >
      <div
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text3)',
          letterSpacing: 0.3
        }}
      >
        {L.appName}
      </div>
      <div
        style={
          {
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            color: offlineReady ? 'var(--ac-grn2)' : 'var(--text4)',
            WebkitAppRegion: 'no-drag'
          } as React.CSSProperties
        }
      >
        <Dot color={offlineReady ? '#22c55e' : '#64748b'} size={8} pulse={offlineReady} />
        {L.offline}
      </div>
    </div>
  )
}
