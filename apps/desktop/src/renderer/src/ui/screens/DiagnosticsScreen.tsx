import type { JSX } from 'react'
import { useSessionStore } from '../../stores/session-store'
import { EventLog } from '../components/EventLog'
import { HealthCard } from '../components/HealthCard'
import { StatusDot } from '../components/StatusDot'

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-mono text-lg text-slate-100">{value}</div>
    </div>
  )
}

const ms = (v: number | null): string => (v == null ? '—' : `${v} ms`)

export function DiagnosticsScreen(): JSX.Element {
  const wsStatus = useSessionStore((s) => s.wsStatus)
  const metrics = useSessionStore((s) => s.metrics)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <HealthCard />
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 flex items-center gap-2">
            <StatusDot ok={wsStatus === 'connected'} />
            <h2 className="font-medium">WebSocket · /ws</h2>
          </div>
          <p className="text-sm text-slate-400">
            Trạng thái kênh: <span className="font-mono text-slate-200">{wsStatus}</span>
          </p>
        </section>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 font-medium">Độ trễ (utterance gần nhất)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="ASR" value={ms(metrics.lastAsrMs)} />
          <Metric label="Dịch (MT)" value={ms(metrics.lastMtMs)} />
          <Metric label="TTS (thời lượng)" value={ms(metrics.lastTtsDurationMs)} />
          <Metric label="Số utterance" value={String(metrics.utteranceCount)} />
        </div>
      </section>

      <EventLog />
    </div>
  )
}
