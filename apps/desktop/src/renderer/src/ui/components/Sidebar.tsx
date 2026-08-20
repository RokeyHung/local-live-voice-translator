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
  { id: 'about', icon: 'info', color: '#818cf8' },
  { id: 'logs', icon: 'terminal', color: '#94a3b8' }
]

// `idle` = service sống nhưng model chưa nạp (service không nạp lúc khởi động).
// Chỉ được nói "Sẵn sàng Offline" khi model đã thật sự nằm trong bộ nhớ.
export type ServiceStatus = 'ready' | 'idle' | 'connecting' | 'down'

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
    about: L.about,
    logs: L.logs
  }

  const footer = {
    ready: {
      title: L.offlineReady,
      sub: L.noCloud,
      titleClass: 'text-ac-grn',
      subClass: 'text-ac-grn-3',
      box: 'border-[rgba(34,197,94,.2)] bg-[rgba(34,197,94,.08)]',
      dot: '#22c55e'
    },
    idle: {
      title: L.modelsIdleBadge,
      sub: L.mbIdleHint,
      titleClass: 'text-fg-2',
      subClass: 'text-fg-4',
      box: 'border-line-strong bg-surface',
      dot: '#64748b'
    },
    connecting: {
      title: L.connecting,
      sub: L.appName,
      titleClass: 'text-[#22d3ee]',
      subClass: 'text-fg-3',
      box: 'border-[rgba(34,211,238,.2)] bg-[rgba(34,211,238,.08)]',
      dot: '#22d3ee'
    },
    down: {
      title: L.serviceDown,
      sub: L.serviceDownSub,
      titleClass: 'text-ac-org',
      subClass: 'text-fg-3',
      box: 'border-[rgba(251,146,60,.2)] bg-[rgba(251,146,60,.08)]',
      dot: '#fb923c'
    }
  }[status]

  return (
    <aside className="flex w-59 shrink-0 flex-col gap-1.5 border-r border-line bg-sidebar px-3.5 py-4.5 backdrop-blur-xl">
      <div className="flex items-center gap-2.75 px-2 pt-1.5 pb-4">
        <div className="flex size-9.5 shrink-0 items-center justify-center rounded-[11px] bg-linear-[135deg,#22d3ee,#3b82f6] text-[#04121a] shadow-[0_6px_18px_rgba(34,211,238,.35)]">
          <Icon name="mic" size={21} strokeWidth={2.4} />
        </div>
        <div className="min-w-0">
          <div className="text-md leading-tight font-bold">Voice Translator</div>
          <div className="text-xs font-medium text-fg-4">v{__APP_VERSION__} · Local AI</div>
        </div>
      </div>

      {NAV.map((item) => {
        const active = screen === item.id
        return (
          <button
            key={item.id}
            onClick={() => setScreen(item.id)}
            className={[
              'flex w-full cursor-pointer items-center gap-2.75 rounded-[11px] border px-3 py-2.5 text-left text-md transition-all',
              active
                ? 'border-line-strong bg-line font-semibold text-fg'
                : 'border-transparent bg-transparent font-medium text-fg-3 hover:bg-line-soft hover:text-fg'
            ].join(' ')}
          >
            <span className="flex" style={{ color: item.color }}>
              <Icon name={item.icon} size={17} />
            </span>
            <span className="flex-1">{labels[item.id]}</span>
            {active && <Dot color={item.color} size={6} />}
          </button>
        )
      })}

      <div className="flex-1" />

      <div
        className={`flex items-center gap-2.25 rounded-[11px] border px-2.75 py-2.25 ${footer.box}`}
      >
        <Dot color={footer.dot} size={9} pulse />
        <div className="min-w-0">
          <div className={`text-sm font-semibold ${footer.titleClass}`}>{footer.title}</div>
          <div className={`text-[10px] ${footer.subClass}`}>{footer.sub}</div>
        </div>
      </div>
    </aside>
  )
}
