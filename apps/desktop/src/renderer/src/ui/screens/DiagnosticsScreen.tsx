// Màn Chẩn đoán: phân rã độ trễ của câu gần nhất, đo độ trễ theo yêu cầu, tài
// nguyên tiến trình service và nhật ký WebSocket thô.

import type { JSX } from 'react'
import { prettyGpuName } from '../../adapters/compute-probe'
import { FRAME_SAMPLES, TARGET_SAMPLE_RATE } from '../../adapters/pcm16-stream'
import { useBenchmark, useResources } from '../../hooks/use-config'
import { useHealth } from '../../hooks/use-health'
import { useCompute, useDict, useIsScreen } from '../../hooks/use-ui'
import { useSessionStore } from '../../stores/session-store'
import { Icon } from '../components/Icon'
import { Badge, EmptyState, Notice, ScreenHeader } from '../components/primitives'
import { PRIMARY_BUTTON, SCREEN } from '../styles'

function LatencyBar({
  label,
  value,
  max,
  color
}: {
  label: string
  value: number | null
  max: number
  color: string
}): JSX.Element {
  const pct = value == null ? 0 : Math.min(100, Math.round((value / max) * 100))
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="font-semibold text-fg-2">{label}</span>
        <span className="font-mono" style={{ color: value == null ? 'var(--text5)' : color }}>
          {value == null ? '—' : `${value}ms`}
        </span>
      </div>
      <div className="h-2.25 overflow-hidden rounded-full bg-line-soft">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg,${color},${color}99)` }}
        />
      </div>
    </div>
  )
}

function InfoTile({
  label,
  value,
  unit,
  note,
  color
}: {
  label: string
  value: string
  unit?: string
  note?: string
  color: string
}): JSX.Element {
  return (
    <div className="panel min-w-0 p-4">
      <div className="label-caps text-sm">{label}</div>
      <div className="truncate-1 mt-2 font-mono text-[20px] font-extrabold" style={{ color }}>
        {value}
        {unit && <span className="text-md font-medium text-fg-4">{unit}</span>}
      </div>
      {note && <div className="mt-1.75 text-xs text-fg-4">{note}</div>}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2.5 rounded-xl border border-line bg-sidebar px-4 py-3.5">
      <span className="text-sm text-fg-3">{label}</span>
      <span className="font-mono text-base font-semibold text-fg-2">{value}</span>
    </div>
  )
}

export function DiagnosticsScreen(): JSX.Element {
  const L = useDict()
  const compute = useCompute()
  const health = useHealth()
  const benchmark = useBenchmark()
  // Màn bị ẩn (người dùng đang ở tab khác) thì ngừng hỏi tài nguyên: nhịp 2 giây
  // cho một biểu đồ không ai nhìn là lãng phí.
  const visible = useIsScreen('diagnostics')
  const resources = useResources(health.isSuccess && visible)
  const config = useSessionStore((s) => s.config)
  const metrics = useSessionStore((s) => s.metrics)
  const log = useSessionStore((s) => s.log)
  const reset = useSessionStore((s) => s.reset)
  const active = useSessionStore((s) => s.active)

  const bench = benchmark.data ?? null
  const benchMax = bench ? Math.max(bench.vadMs, bench.asrMs, bench.mtMs, bench.ttsMs ?? 0, 1) : 1
  const hasActivity = metrics.utteranceCount > 0 || active
  const max = Math.max(
    1200,
    metrics.lastAsrMs ?? 0,
    metrics.lastMtMs ?? 0,
    metrics.lastTtsDurationMs ?? 0
  )
  const benchDisabled = !health.isSuccess || benchmark.isPending

  return (
    <div className={SCREEN}>
      <ScreenHeader
        icon="bolt"
        title={L.diagnostics}
        subtitle={L.diagSub}
        color="#22c55e"
        tint="rgba(34,197,94,.12)"
      />

      {hasActivity ? (
        <div className="panel px-5 py-4.5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="text-base font-bold">{L.latencyBreak}</span>
            {metrics.measured && <Badge color="var(--text4)">client</Badge>}
          </div>
          <div className="flex flex-col gap-3.5">
            <LatencyBar
              label="ASR · whisper.cpp"
              value={metrics.lastAsrMs}
              max={max}
              color="#22d3ee"
            />
            <LatencyBar label="MT · NLLB-200" value={metrics.lastMtMs} max={max} color="#fb923c" />
            <LatencyBar
              label="TTS · sherpa-onnx"
              value={metrics.lastTtsDurationMs}
              max={max}
              color="#d946ef"
            />
            <LatencyBar
              label={L.endToEnd}
              value={metrics.lastTotalMs}
              max={Math.max(max * 2, metrics.lastTotalMs ?? 0)}
              color="var(--ac-mag)"
            />
          </div>
        </div>
      ) : (
        <div className="panel border-dashed border-line-strong">
          <EmptyState icon="bolt" title={L.diagEmptyT} body={L.diagEmptyS} color="var(--ac-grn2)" />
        </div>
      )}

      {/* benchmark — chạy thật qua POST /api/benchmark */}
      <div className="panel px-5 py-4.5">
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex text-[#22d3ee]">
              <Icon name="bolt" size={17} />
            </span>
            <div>
              <div className="text-md font-bold">{L.benchTitle}</div>
              <div className="mt-px text-sm text-fg-3">{L.benchDesc}</div>
            </div>
          </div>
          <button
            onClick={() =>
              benchmark.mutate({
                source: config.outgoing.source,
                target: config.outgoing.target
              })
            }
            disabled={benchDisabled}
            className={PRIMARY_BUTTON}
          >
            <Icon
              name={benchmark.isPending ? 'spinner' : 'play'}
              size={14}
              spin={benchmark.isPending}
              strokeWidth={benchmark.isPending ? 2.6 : 2}
            />
            {benchmark.isPending ? L.benchRunning : bench ? L.benchAgain : L.benchRun}
          </button>
        </div>

        {benchmark.isError && (
          <div className="mt-3.5">
            <Notice
              tone="error"
              icon="warning"
              title={L.benchFailed}
              body={benchmark.error?.message}
            />
          </div>
        )}

        {!bench && !benchmark.isPending && !benchmark.isError && (
          <div className="mt-4 rounded-lg border border-dashed border-line-strong p-5.5 text-center text-sm text-fg-4">
            {L.benchIdle}
          </div>
        )}

        {bench && (
          <div className="mt-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-fg-4">
              <span>{L.benchOn}:</span>
              <span className="font-mono font-semibold text-fg-2">
                {bench.source.toUpperCase()} → {bench.target.toUpperCase()}
              </span>
              {bench.preset && <Badge color="var(--text4)">{bench.preset}</Badge>}
            </div>
            <div className="flex flex-col gap-3">
              <LatencyBar
                label="VAD · Silero"
                value={bench.vadMs}
                max={benchMax}
                color="var(--ac-grn2)"
              />
              <LatencyBar
                label="ASR · whisper.cpp"
                value={bench.asrMs}
                max={benchMax}
                color="#22d3ee"
              />
              <LatencyBar label="MT · NLLB-200" value={bench.mtMs} max={benchMax} color="#fb923c" />
              <LatencyBar
                label="TTS · sherpa-onnx"
                value={bench.ttsMs}
                max={benchMax}
                color="#d946ef"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[rgba(34,211,238,.22)] bg-[rgba(34,211,238,.08)] px-4 py-3.25">
              <span className="text-base font-bold text-ac-cyan">{L.benchTotal}</span>
              <span className="flex items-baseline gap-2.5 font-mono">
                <span className="text-[16px] font-extrabold text-[#22d3ee]">{bench.totalMs}ms</span>
                <span className="text-sm text-fg-4">
                  ×{(bench.totalMs / bench.audioMs).toFixed(2)} {L.rtFactor}
                </span>
              </span>
            </div>
            <div className="mt-2.5 text-xs leading-normal text-fg-5">{L.benchNote}</div>
          </div>
        )}
      </div>

      {/* tài nguyên thật của tiến trình service */}
      <div>
        <div className="label-caps mb-2">{L.resourcesT}</div>
        <div className="grid grid-cols-4 gap-3.5">
          <InfoTile
            label={L.serviceCpu}
            value={resources.data ? resources.data.cpuPercent.toFixed(0) : '—'}
            unit="%"
            note={resources.data ? `${resources.data.cpuCount} ${L.cores}` : L.serviceDown}
            color="#22d3ee"
          />
          <InfoTile
            label={L.serviceRam}
            value={resources.data ? (resources.data.rssMb / 1024).toFixed(2) : '—'}
            unit=" GB"
            note={resources.data ? `${resources.data.threads} ${L.serviceThreads}` : undefined}
            color="var(--ac-grn2)"
          />
          <InfoTile
            label={L.systemRam}
            value={resources.data ? resources.data.systemUsedPercent.toFixed(0) : '—'}
            unit="%"
            note={
              resources.data
                ? `/ ${(resources.data.systemTotalMb / 1024).toFixed(0)} GB`
                : undefined
            }
            color="#fb923c"
          />
          <InfoTile
            label={L.gpuLbl}
            value={compute ? prettyGpuName(compute.gpuRenderer) || L.notAvail : '—'}
            note={compute?.recommended}
            color="#d946ef"
          />
        </div>
      </div>

      {/* đường tín hiệu audio */}
      <div>
        <div className="label-caps mb-2">{L.audioT}</div>
        <div className="grid grid-cols-3 gap-3.5">
          <StatRow label={L.sampleRate} value={`${TARGET_SAMPLE_RATE / 1000} kHz mono`} />
          <StatRow
            label={L.frameSize}
            value={`${FRAME_SAMPLES} (${(FRAME_SAMPLES / TARGET_SAMPLE_RATE) * 1000} ms)`}
          />
          <StatRow label={L.utterCount} value={String(metrics.utteranceCount)} />
        </div>
      </div>

      {/* nhật ký WS */}
      <div className="panel px-4.5 py-4">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-base font-bold">{L.wsLog}</span>
          <button
            onClick={reset}
            className="cursor-pointer border-none bg-transparent text-sm text-fg-4 hover:text-fg-2"
          >
            {L.clear}
          </button>
        </div>
        <pre className="cs m-0 max-h-55 overflow-auto rounded-md bg-inset p-3 font-mono text-sm leading-relaxed text-fg-3">
          {log.length === 0
            ? L.noMessages
            : log.map((m) => `${m.type}  ${JSON.stringify(m.payload)}`).join('\n')}
        </pre>
      </div>
    </div>
  )
}
