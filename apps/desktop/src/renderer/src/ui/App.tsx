import { useState, type JSX } from 'react'
import { PLATFORM } from '../application/config'
import { useSession } from '../hooks/use-session'
import { useSessionStore } from '../stores/session-store'
import { StatusDot } from './components/StatusDot'
import { DiagnosticsScreen } from './screens/DiagnosticsScreen'
import { SessionScreen } from './screens/SessionScreen'
import { SetupScreen } from './screens/SetupScreen'
import { SubtitleScreen } from './screens/SubtitleScreen'

type Tab = 'setup' | 'session' | 'subtitle' | 'diagnostics'

const TABS: { id: Tab; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'session', label: 'Session' },
  { id: 'subtitle', label: 'Subtitle' },
  { id: 'diagnostics', label: 'Diagnostics' }
]

export default function App(): JSX.Element {
  const actions = useSession()
  const [tab, setTab] = useState<Tab>('setup')
  const wsStatus = useSessionStore((s) => s.wsStatus)

  return (
    <div className="min-h-screen w-full bg-slate-950 p-6 text-slate-100">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Local Live Voice Translator</h1>
          <p className="text-sm text-slate-400">
            Dịch giọng nói cục bộ · mic → ASR → dịch → TTS ({PLATFORM})
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <StatusDot ok={wsStatus === 'connected'} />
          <span className="font-mono">{wsStatus}</span>
        </div>
      </header>

      <nav className="mb-5 flex gap-1 border-b border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? 'border-indigo-500 text-slate-100'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'setup' && <SetupScreen />}
      {tab === 'session' && <SessionScreen actions={actions} />}
      {tab === 'subtitle' && <SubtitleScreen />}
      {tab === 'diagnostics' && <DiagnosticsScreen />}
    </div>
  )
}
