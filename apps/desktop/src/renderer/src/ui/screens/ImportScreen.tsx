// Màn Nhập tệp: chuyển tệp âm thanh có sẵn thành văn bản.
//
// AI service mới chỉ có pipeline realtime qua WebSocket, chưa có endpoint xử lý
// theo lô, nên vùng thả tệp hiển thị ở trạng thái tắt thay vì giả lập tiến trình.

import type { JSX } from 'react'
import { useDict } from '../../hooks/use-ui'
import { Icon } from '../components/Icon'
import { Badge, Notice, ScreenHeader } from '../components/primitives'
import { PANEL } from '../styles'

export function ImportScreen(): JSX.Element {
  const L = useDict()

  return (
    <div
      style={{
        padding: '22px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 840
      }}
    >
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
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '44px 24px',
          borderRadius: 20,
          border: '2px dashed var(--line-strong)',
          background: 'var(--surface)',
          opacity: 0.6,
          cursor: 'not-allowed'
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface)',
            color: '#2dd4bf',
            marginBottom: 16
          }}
        >
          <Icon name="upload" size={30} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{L.importDisabledT}</div>
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--text3)',
            marginTop: 8,
            maxWidth: 460,
            lineHeight: 1.5
          }}
        >
          {L.importDisabledS}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text5)', marginTop: 14 }}>{L.dropSub}</div>
      </div>

      <div style={{ ...PANEL, padding: 0 }}>
        <Notice tone="info" icon="info" title={L.notSupported} body={L.notSupportedYet} />
      </div>
    </div>
  )
}
