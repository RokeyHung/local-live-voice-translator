import type { JSX } from 'react'
import type { PipelineState } from '../../domain/enums'

const COLORS: Record<PipelineState, string> = {
  Idle: 'bg-slate-700 text-slate-200',
  Listening: 'bg-sky-600 text-white',
  SpeechDetected: 'bg-sky-500 text-white',
  Recognizing: 'bg-amber-600 text-white',
  Translating: 'bg-violet-600 text-white',
  WaitingForConfirmation: 'bg-amber-500 text-white',
  Synthesizing: 'bg-fuchsia-600 text-white',
  Queued: 'bg-slate-600 text-white',
  Speaking: 'bg-emerald-600 text-white',
  Completed: 'bg-emerald-700 text-white',
  Error: 'bg-rose-600 text-white',
  Stopped: 'bg-slate-700 text-slate-200'
}

export function StateBadge({ state }: { state: PipelineState | null }): JSX.Element {
  const label = state ?? '—'
  const cls = state ? COLORS[state] : 'bg-slate-800 text-slate-400'
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}
