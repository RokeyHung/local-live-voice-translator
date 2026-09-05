// Thanh tiêu đề của cửa sổ. Trên macOS nút đèn giao thông thật của hệ điều hành
// nằm chồng lên thanh này (titleBarStyle: 'hiddenInset') nên chừa lề trái; toàn
// thanh là vùng kéo cửa sổ.

import type { CSSProperties, JSX } from 'react'
import { PLATFORM } from '../../application/config'
import { useDict } from '../../hooks/use-ui'

// -webkit-app-region chưa có trong kiểu CSSProperties của React.
const DRAG = { WebkitAppRegion: 'drag' } as CSSProperties

export function TitleBar(): JSX.Element {
  const L = useDict()
  const isMac = PLATFORM === 'darwin'

  return (
    <div
      className={`flex h-9 shrink-0 items-center gap-3.5 border-b border-line bg-inset backdrop-blur-xl ${
        isMac ? 'pr-4 pl-21' : 'px-4'
      }`}
      style={DRAG}
    >
      <div className="flex-1 text-center text-sm font-semibold tracking-[0.3px] text-fg-3">
        {L.appName}
      </div>
    </div>
  )
}
