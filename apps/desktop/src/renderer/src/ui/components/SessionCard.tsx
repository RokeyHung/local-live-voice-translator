import type { JSX } from 'react'
import type { SessionActions } from '../../hooks/use-session'
import { useSessionStore } from '../../stores/session-store'
import { Button } from './Button'
import { StatusDot } from './StatusDot'

export function SessionCard({ actions }: { actions: SessionActions }): JSX.Element {
  const wsStatus = useSessionStore((s) => s.wsStatus)
  const lastState = useSessionStore((s) => s.lastState)
  const wsOk = wsStatus === 'connected'

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <StatusDot ok={wsOk} />
        <h2 className="font-medium">WebSocket · /ws</h2>
      </div>
      <p className="mb-3 text-sm">
        Trạng thái kênh: <span className="font-mono">{wsStatus}</span>
        {lastState && (
          <>
            {' · '}pipeline: <span className="font-mono text-emerald-300">{lastState}</span>
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => actions.startSession()} disabled={!wsOk}>
          session.start
        </Button>
        <Button onClick={() => actions.ptt(true)} disabled={!wsOk}>
          PTT ↓
        </Button>
        <Button onClick={() => actions.ptt(false)} disabled={!wsOk}>
          PTT ↑
        </Button>
        <Button onClick={() => actions.stopSession()} disabled={!wsOk}>
          session.stop
        </Button>
      </div>
    </section>
  )
}
