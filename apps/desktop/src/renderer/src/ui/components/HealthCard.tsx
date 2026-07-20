import type { JSX } from 'react'
import { useHealth } from '../../hooks/use-health'
import { StatusDot } from './StatusDot'

function Row({ k, v }: { k: string; v: string }): JSX.Element {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{k}</dt>
      <dd className="font-mono">{v}</dd>
    </div>
  )
}

export function HealthCard(): JSX.Element {
  const health = useHealth()

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <StatusDot ok={health.isSuccess} />
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
  )
}
