import type { JSX } from 'react'
import { LANGUAGE_LABELS, PRESET_LABELS } from '../../domain/models'
import type { SessionActions } from '../../hooks/use-session'
import { useSessionStore } from '../../stores/session-store'
import { Button } from '../components/Button'
import { StateBadge } from '../components/StateBadge'
import { SubtitleList } from '../components/SubtitleList'

export function SessionScreen({ actions }: { actions: SessionActions }): JSX.Element {
  const wsStatus = useSessionStore((s) => s.wsStatus)
  const active = useSessionStore((s) => s.active)
  const config = useSessionStore((s) => s.config)
  const pipelineState = useSessionStore((s) => s.pipelineState)
  const utterances = useSessionStore((s) => s.utterances)
  const lastError = useSessionStore((s) => s.lastError)
  const wsOk = wsStatus === 'connected'

  const recent = utterances.slice(-6)

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StateBadge state={pipelineState} />
            <span className="text-sm text-slate-400">
              {PRESET_LABELS[config.preset]} · {config.mode}
              {config.mode !== 'listen' && (
                <>
                  {' · '}
                  {LANGUAGE_LABELS[config.outgoing.source]} →{' '}
                  {LANGUAGE_LABELS[config.outgoing.target]}
                </>
              )}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {!active ? (
              <Button onClick={() => actions.start()} disabled={!wsOk}>
                Bắt đầu
              </Button>
            ) : (
              <Button onClick={() => actions.stop()}>Dừng</Button>
            )}
            <button
              onMouseDown={() => actions.ptt(true)}
              onMouseUp={() => actions.ptt(false)}
              onMouseLeave={() => actions.ptt(false)}
              disabled={!active}
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Push-to-talk (giữ)
            </button>
          </div>
        </div>
        {!wsOk && (
          <p className="text-sm text-rose-400">
            Chưa kết nối AI service. Chạy <code>make service</code> rồi thử lại.
          </p>
        )}
        {lastError && (
          <p className="text-sm text-rose-400">
            Lỗi: <span className="font-mono">{lastError.code}</span> — {lastError.message}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 font-medium">Phụ đề trực tiếp</h2>
        <SubtitleList utterances={recent} />
      </section>
    </div>
  )
}
