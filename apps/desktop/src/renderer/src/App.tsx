import { useEffect, useRef, type JSX, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchHealth } from './api/client'
import { connectSession, sendMessage } from './api/ws'
import { PLATFORM } from './api/config'
import { useSessionStore } from './store/session'

function StatusDot({ ok }: { ok: boolean }): JSX.Element {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-rose-500'}`}
    />
  )
}

function Row({ k, v }: { k: string; v: string }): JSX.Element {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{k}</dt>
      <dd className="font-mono">{v}</dd>
    </div>
  )
}

function Btn({
  children,
  onClick,
  disabled
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function App(): JSX.Element {
  const wsRef = useRef<WebSocket | null>(null)
  const { wsStatus, lastState, log, setWsStatus, pushMessage, reset } = useSessionStore()

  // REST: kiểm tra sức khỏe AI service.
  const health = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 5000,
    retry: false
  })

  // WebSocket: kết nối kênh phiên.
  useEffect(() => {
    setWsStatus('connecting')
    const ws = connectSession({
      onOpen: () => setWsStatus('connected'),
      onMessage: (msg) => pushMessage(msg),
      onClose: () => setWsStatus('disconnected'),
      onError: () => setWsStatus('disconnected')
    })
    wsRef.current = ws
    return () => ws.close()
  }, [setWsStatus, pushMessage])

  const send = (type: string, payload: Record<string, unknown> = {}): void => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) sendMessage(ws, type, payload)
  }

  const restOk = health.isSuccess
  const wsOk = wsStatus === 'connected'

  return (
    <div className="min-h-screen w-full bg-slate-950 p-6 text-slate-100">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Local Live Voice Translator</h1>
        <p className="text-sm text-slate-400">
          Tuần 1 — kiểm tra kết nối desktop client ↔ local AI service ({PLATFORM})
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* REST health */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 flex items-center gap-2">
            <StatusDot ok={restOk} />
            <h2 className="font-medium">REST · /health</h2>
          </div>
          {health.isLoading && <p className="text-sm text-slate-400">Đang kiểm tra…</p>}
          {health.isError && (
            <p className="text-sm text-rose-400">
              Không kết nối được AI service. Hãy chạy <code>uv run llvt-ai-service</code>.
            </p>
          )}
          {health.data && (
            <dl className="space-y-1 text-sm">
              <Row k="status" v={health.data.status} />
              <Row k="version" v={health.data.version} />
              <Row k="platform" v={health.data.platform} />
              <Row k="offlineReady" v={String(health.data.offlineReady)} />
            </dl>
          )}
        </section>

        {/* WebSocket */}
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
            <Btn onClick={() => send('session.start', { mode: 'two_way' })} disabled={!wsOk}>
              session.start
            </Btn>
            <Btn onClick={() => send('control.ptt', { pressed: true })} disabled={!wsOk}>
              PTT ↓
            </Btn>
            <Btn onClick={() => send('control.ptt', { pressed: false })} disabled={!wsOk}>
              PTT ↑
            </Btn>
            <Btn onClick={() => send('session.stop')} disabled={!wsOk}>
              session.stop
            </Btn>
          </div>
        </section>
      </div>

      {/* Message log */}
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
    </div>
  )
}

export default App
