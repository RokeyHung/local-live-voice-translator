// Thanh tiêu đề của cửa sổ. Trên macOS nút đèn giao thông thật của hệ điều hành
// nằm chồng lên thanh này (titleBarStyle: 'hiddenInset') nên chừa lề trái; toàn
// thanh là vùng kéo cửa sổ, riêng phần chỉ báo thì không.

import type { CSSProperties, JSX } from 'react'
import { PLATFORM } from '../../application/config'
import { useDict } from '../../hooks/use-ui'
import { Dot } from './primitives'

// -webkit-app-region chưa có trong kiểu CSSProperties của React.
const DRAG = { WebkitAppRegion: 'drag' } as CSSProperties
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as CSSProperties

export function TitleBar({ offlineReady }: { offlineReady: boolean }): JSX.Element {
  const L = useDict()
  const isMac = PLATFORM === 'darwin'

  return (
    <div
      className={`flex h-11 shrink-0 items-center gap-3.5 border-b border-line bg-inset backdrop-blur-xl ${
        isMac ? 'pr-4 pl-21' : 'px-4'
      }`}
      style={DRAG}
    >
      <div className="flex-1 text-center text-sm font-semibold tracking-[0.3px] text-fg-3">
        {L.appName}
      </div>
      <div
        className={`flex items-center gap-1.5 text-sm font-semibold ${
          offlineReady ? 'text-ac-grn-2' : 'text-fg-4'
        }`}
        style={NO_DRAG}
      >
        <Dot color={offlineReady ? '#22c55e' : '#64748b'} size={8} pulse={offlineReady} />
        {L.offline}
      </div>
    </div>
  )
}
