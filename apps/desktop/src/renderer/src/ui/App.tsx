import type { JSX } from 'react'
import { PLATFORM } from '../application/config'
import { useSession } from '../hooks/use-session'
import { EventLog } from './components/EventLog'
import { HealthCard } from './components/HealthCard'
import { SessionCard } from './components/SessionCard'

export default function App(): JSX.Element {
  const actions = useSession()

  return (
    <div className="min-h-screen w-full bg-slate-950 p-6 text-slate-100">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Local Live Voice Translator</h1>
        <p className="text-sm text-slate-400">
          Tuần 2 — thu microphone → VAD (Silero) qua local AI service ({PLATFORM})
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <HealthCard />
        <SessionCard actions={actions} />
      </div>

      <EventLog />
    </div>
  )
}
