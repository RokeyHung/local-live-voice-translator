// Màn Chẩn đoán: phân rã độ trễ của câu gần nhất, thông tin phần cứng, đường tín
// hiệu audio và nhật ký WebSocket thô.

import type { JSX } from 'react'
import { prettyGpuName } from '../../adapters/compute-probe'
import { PLATFORM } from '../../application/config'
import { useHealth } from '../../hooks/use-health'
import { useCompute, useDict } from '../../hooks/use-ui'
import { useSessionStore } from '../../stores/session-store'
import { Icon } from '../components/Icon'
import { Badge, DisabledButton, EmptyState, ScreenHeader } from '../components/primitives'
import { LABEL, MONO, PANEL } from '../styles'

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
      <div
        style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}
      >
        <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{label}</span>
        <span style={{ color: value == null ? 'var(--text5)' : color, ...MONO }}>
          {value == null ? '—' : `${value}ms`}
        </span>
      </div>
      <div
        style={{
          height: 9,
          borderRadius: 9999,
          background: 'var(--line-soft)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 9999,
            background: `linear-gradient(90deg,${color},${color}99)`,
            transition: 'width .3s'
          }}
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
    <div style={{ ...PANEL, padding: 16, minWidth: 0 }}>
      <div style={{ ...LABEL, fontSize: 11 }}>{label}</div>
      <div
        title={value}
        style={{
          fontSize: 20,
          fontWeight: 800,
          marginTop: 8,
          color,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          ...MONO
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: 13, color: 'var(--text4)', fontWeight: 500 }}>{unit}</span>
        )}
      </div>
      {note && <div style={{ fontSize: 10.5, color: 'var(--text4)', marginTop: 7 }}>{note}</div>}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid var(--line)',
        background: 'var(--sidebar)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{label}</span>
      <span style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 600, ...MONO }}>
        {value}
      </span>
    </div>
  )
}

export function DiagnosticsScreen(): JSX.Element {
  const L = useDict()
  const compute = useCompute()
  const health = useHealth()
  const metrics = useSessionStore((s) => s.metrics)
  const log = useSessionStore((s) => s.log)
  const reset = useSessionStore((s) => s.reset)
  const active = useSessionStore((s) => s.active)

  const hasActivity = metrics.utteranceCount > 0 || active
  const max = Math.max(
    1200,
    metrics.lastAsrMs ?? 0,
    metrics.lastMtMs ?? 0,
    metrics.lastTtsDurationMs ?? 0
  )

  return (
    <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader
        icon="bolt"
        title={L.diagnostics}
        subtitle={L.diagSub}
        color="#22c55e"
        tint="rgba(34,197,94,.12)"
      />

      {hasActivity ? (
        <div style={{ ...PANEL, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{L.latencyBreak}</span>
            {metrics.measured && <Badge color="var(--text4)">client</Badge>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
        <div style={{ ...PANEL, border: '1px dashed var(--line-strong)' }}>
          <EmptyState icon="bolt" title={L.diagEmptyT} body={L.diagEmptyS} color="var(--ac-grn2)" />
        </div>
      )}

      {/* benchmark — chưa có endpoint */}
      <div style={{ ...PANEL, padding: '18px 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#22d3ee', display: 'flex' }}>
              <Icon name="bolt" size={17} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{L.benchTitle}</span>
                <Badge color="var(--text4)">{L.notSupported}</Badge>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 1 }}>
                {L.benchDesc}
              </div>
            </div>
          </div>
          <DisabledButton label={L.benchRun} hint={L.benchDisabled} icon="play" />
        </div>
      </div>

      {/* phần cứng */}
      <div>
        <div style={{ ...LABEL, marginBottom: 8 }}>{L.resourcesT}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 14 }}>
          <InfoTile
            label={L.cpuLbl}
            value={compute?.cpuCores ? String(compute.cpuCores) : '—'}
            unit={compute?.cpuCores ? ` ${L.cores}` : undefined}
            note={PLATFORM}
            color="#22d3ee"
          />
          <InfoTile
            label={L.ramLbl}
            value={compute?.ramGb ? `${compute.ramCapped ? '≥' : ''}${compute.ramGb}` : '—'}
            unit=" GB"
            note={compute?.ramCapped ? L.atLeast : undefined}
            color="var(--ac-grn2)"
          />
          <InfoTile
            label={L.gpuLbl}
            value={compute ? prettyGpuName(compute.gpuRenderer) || L.notAvail : '—'}
            note={compute?.recommended}
            color="#fb923c"
          />
          <InfoTile
            label={L.apiLbl}
            value={compute?.webgpu ? 'WebGPU' : 'WebGL'}
            note={health.data?.version ? `service ${health.data.version}` : L.serviceDown}
            color="#d946ef"
          />
        </div>
      </div>

      {/* đường tín hiệu audio */}
      <div>
        <div style={{ ...LABEL, marginBottom: 8 }}>{L.audioT}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 14 }}>
          <StatRow label={L.sampleRate} value="16 kHz mono" />
          <StatRow label={L.frameSize} value="1600 (100 ms)" />
          <StatRow label={L.utterCount} value={String(metrics.utteranceCount)} />
        </div>
      </div>

      {/* nhật ký WS */}
      <div style={{ ...PANEL, padding: '16px 18px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{L.wsLog}</span>
          <button
            onClick={reset}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text4)',
              fontSize: 11.5,
              cursor: 'pointer'
            }}
          >
            {L.clear}
          </button>
        </div>
        <pre
          className="cs"
          style={{
            margin: 0,
            maxHeight: 220,
            overflow: 'auto',
            borderRadius: 10,
            background: 'var(--inset)',
            padding: 12,
            fontSize: 11,
            lineHeight: 1.6,
            color: 'var(--text3)',
            ...MONO
          }}
        >
          {log.length === 0
            ? L.noMessages
            : log.map((m) => `${m.type}  ${JSON.stringify(m.payload)}`).join('\n')}
        </pre>
      </div>
    </div>
  )
}
