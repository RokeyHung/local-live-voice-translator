import type { JSX } from 'react'
import { useSessionStore } from '../../stores/session-store'

export function EventLog(): JSX.Element {
  const log = useSessionStore((s) => s.log)
  const reset = useSessionStore((s) => s.reset)

  return (
    <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Nhật ký WebSocket</h2>
        <button className="text-xs text-slate-400 hover:text-slate-200" onClick={reset}>
          Xóa
        </button>
      </div>
      <pre className="max-h-64 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-300">
        {log.length === 0
          ? '— chưa có message —'
          : log.map((m) => `${m.type}  ${JSON.stringify(m.payload)}`).join('\n')}
      </pre>
    </section>
  )
}
