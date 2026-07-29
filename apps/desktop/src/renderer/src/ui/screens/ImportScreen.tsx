// Màn Nhập tệp: chuyển tệp âm thanh có sẵn thành văn bản.
//
// AI service mới chỉ có pipeline realtime qua WebSocket, chưa có endpoint xử lý
// theo lô, nên vùng thả tệp hiển thị ở trạng thái tắt thay vì giả lập tiến trình.

import type { JSX } from 'react'
import { useDict } from '../../hooks/use-ui'
import { Icon } from '../components/Icon'
import { Badge, Notice, ScreenHeader } from '../components/primitives'
import { SCREEN } from '../styles'

export function ImportScreen(): JSX.Element {
  const L = useDict()

  return (
    <div className={`${SCREEN} max-w-210`}>
      <ScreenHeader
        icon="upload"
        title={L.importFiles}
        subtitle={L.importSub}
        color="#2dd4bf"
        tint="rgba(45,212,191,.14)"
        right={<Badge color="var(--text4)">{L.notSupported}</Badge>}
      />

      <div
        aria-disabled
        className="flex cursor-not-allowed flex-col items-center justify-center rounded-[20px] border-2 border-dashed border-line-strong bg-surface px-6 py-11 text-center opacity-60"
      >
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-surface text-[#2dd4bf]">
          <Icon name="upload" size={30} />
        </div>
        <div className="text-xl font-bold">{L.importDisabledT}</div>
        <div className="mt-2 max-w-115 text-base leading-normal text-fg-3">{L.importDisabledS}</div>
        <div className="mt-3.5 text-sm text-fg-5">{L.dropSub}</div>
      </div>

      <Notice tone="info" icon="info" title={L.notSupported} body={L.notSupportedYet} />
    </div>
  )
}
