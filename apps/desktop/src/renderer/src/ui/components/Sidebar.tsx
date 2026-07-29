// Thanh điều hướng trái + chỉ báo trạng thái AI service ở chân.

import type { JSX } from 'react'
import type { ScreenId } from '../../domain/enums'
import { useDict } from '../../hooks/use-ui'
import { useUiStore } from '../../stores/ui-store'
import { Icon, type IconName } from './Icon'
import { Dot } from './primitives'

interface NavItem {
  id: ScreenId
  icon: IconName
  color: string
}

const NAV: NavItem[] = [
  { id: 'session', icon: 'wave', color: '#22d3ee' },
  { id: 'import', icon: 'upload', color: '#2dd4bf' },
  { id: 'setup', icon: 'sliders', color: '#fb923c' },
  { id: 'models', icon: 'box', color: '#a855f7' },
  { id: 'diagnostics', icon: 'bolt', color: 'var(--ac-grn2)' },
  { id: 'history', icon: 'clock', color: 'var(--ac-mag)' },
  { id: 'settings', icon: 'gear', color: 'var(--ac-sky)' },
  { id: 'about', icon: 'info', color: '#818cf8' }
]

export type ServiceStatus = 'ready' | 'connecting' | 'down'

export function Sidebar({ status }: { status: ServiceStatus }): JSX.Element {
  const L = useDict()
  const screen = useUiStore((s) => s.screen)
  const setScreen = useUiStore((s) => s.setScreen)

  const labels: Record<ScreenId, string> = {
    session: L.session,
    import: L.importFiles,
    setup: L.setup,
    models: L.modelMgr,
    diagnostics: L.diagnostics,
    history: L.history,
    settings: L.settings,
    about: L.about
  }

  const footer = {
    ready: {
      title: L.offlineReady,
      sub: L.noCloud,
      color: 'var(--ac-grn)',
      subColor: 'var(--ac-grn3)',
      bg: 'rgba(34,197,94,.08)',
      border: 'rgba(34,197,94,.2)',
      dot: '#22c55e'
    },
    connecting: {
      title: L.connecting,
      sub: L.appName,
      color: '#22d3ee',
      subColor: 'var(--text3)',
      bg: 'rgba(34,211,238,.08)',
      border: 'rgba(34,211,238,.2)',
      dot: '#22d3ee'
    },
    down: {
      title: L.serviceDown,
      sub: L.serviceDownSub,
      color: 'var(--ac-org)',
      subColor: 'var(--text3)',
      bg: 'rgba(251,146,60,.08)',
      border: 'rgba(251,146,60,.2)',
      dot: '#fb923c'
    }
  }[status]

  return (
    <aside
      style={{
        width: 236,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 14px',
        gap: 6,
        borderRight: '1px solid var(--line)',
        background: 'var(--sidebar)',
        backdropFilter: 'blur(20px)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '6px 8px 16px' }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg,#22d3ee,#3b82f6)',
            boxShadow: '0 6px 18px rgba(34,211,238,.35)',
            color: '#04121a'
          }}
        >
          <Icon name="mic" size={21} strokeWidth={2.4} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.15 }}>Voice Translator</div>
          <div style={{ fontSize: 10.5, color: 'var(--text4)', fontWeight: 500 }}>
            v{__APP_VERSION__} · Local AI
          </div>
        </div>
      </div>

      {NAV.map((item) => {
        const active = screen === item.id
        return (
          <button
            key={item.id}
            className="navbtn"
            onClick={() => setScreen(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              width: '100%',
              padding: '10px 12px',
              borderRadius: 11,
              border: `1px solid ${active ? 'var(--line-strong)' : 'transparent'}`,
              background: active ? 'var(--line)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text3)',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              transition: 'all .15s',
              textAlign: 'left'
            }}
          >
            <span style={{ display: 'flex', color: item.color }}>
              <Icon name={item.icon} size={17} />
            </span>
            <span style={{ flex: 1 }}>{labels[item.id]}</span>
            {active && <Dot color={item.color} size={6} />}
          </button>
        )
      })}

      <div style={{ flex: 1 }} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '9px 11px',
          borderRadius: 11,
          background: footer.bg,
          border: `1px solid ${footer.border}`
        }}
      >
        <Dot color={footer.dot} size={9} pulse />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: footer.color }}>{footer.title}</div>
          <div style={{ fontSize: 10, color: footer.subColor }}>{footer.sub}</div>
        </div>
      </div>
    </aside>
  )
}
