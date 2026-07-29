// Màn Thiết bị âm thanh: chọn/kiểm tra 4 đường tín hiệu, xem phần cứng và thiết
// bị tính toán thật của từng khâu, cảnh báo vòng lặp âm thanh.

import { useState, type JSX } from 'react'
import {
  looksLikeHeadphones,
  looksLikeVirtualMic,
  playTestTone,
  type AudioDevice
} from '../../adapters/audio-devices'
import { prettyGpuName } from '../../adapters/compute-probe'
import { PLATFORM } from '../../application/config'
import type { Dict } from '../../application/i18n'
import { PRESET_META, STAGE_COLORS } from '../../application/presets'
import { useResources, useServiceConfig } from '../../hooks/use-config'
import { useHealth } from '../../hooks/use-health'
import { useAudioDevices, useCompute, useDict, useMicLevel } from '../../hooks/use-ui'
import { useSessionStore } from '../../stores/session-store'
import { useUiStore } from '../../stores/ui-store'
import { Icon, type IconName } from '../components/Icon'
import { Badge, Dot, Meter, Notice, ScreenHeader } from '../components/primitives'
import { SCREEN, SELECT, SELECT_ARROW } from '../styles'

interface DeviceCardProps {
  icon: IconName
  color: string
  title: string
  role: string
  status: { text: string; color: string }
  devices: AudioDevice[]
  value: string
  onChange?: (deviceId: string) => void
  level?: number
  onTest?: () => void
  disabled?: boolean
  readOnly?: boolean // không có bộ chọn thiết bị, chỉ hiện ghi chú
  hint?: string
  L: Dict
}

function DeviceCard({
  icon,
  color,
  title,
  role,
  status,
  devices,
  value,
  onChange,
  level,
  onTest,
  disabled,
  readOnly,
  hint,
  L
}: DeviceCardProps): JSX.Element {
  return (
    <div className={`panel flex flex-col gap-3 px-4.5 py-4 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2.75">
        <span
          className="flex size-8.5 items-center justify-center rounded-md"
          style={{ background: `${color}24`, color }}
        >
          <Icon name={icon} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-md font-bold">{title}</div>
          <div className="text-sm text-fg-4">{role}</div>
        </div>
        <Badge color={status.color}>{status.text}</Badge>
      </div>

      {disabled || readOnly ? (
        <div className="rounded-md border border-dashed border-line-strong bg-inset px-3 py-2.5 text-sm leading-snug text-fg-4">
          {hint}
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={`${SELECT} h-9.5 w-full text-base`}
          style={SELECT_ARROW}
        >
          <option value="">{L.deviceDefault}</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>
      )}

      <div className="flex items-center gap-2.5">
        <Meter value={level ?? 0} color={color} />
        <button
          onClick={onTest}
          disabled={disabled || !onTest}
          title={disabled ? hint : undefined}
          className="h-7.5 cursor-pointer rounded-sm border border-line-strong bg-line-soft px-3.25 text-sm font-semibold text-fg disabled:cursor-not-allowed disabled:opacity-45"
        >
          {L.test}
        </button>
      </div>
    </div>
  )
}

function HwTile({
  label,
  value,
  color
}: {
  label: string
  value: string
  color?: string
}): JSX.Element {
  return (
    <div className="min-w-0 rounded-[11px] border border-line-soft bg-inset px-3.25 py-2.75">
      <div className="label-caps text-2xs tracking-[0.5px]">{label}</div>
      <div
        title={value}
        className="truncate-1 mt-1.25 font-mono text-sm font-semibold"
        style={{ color: color ?? 'var(--text)' }}
      >
        {value}
      </div>
    </div>
  )
}

function StatusRow({
  icon,
  label,
  value,
  color
}: {
  icon: IconName
  label: string
  value: string
  color: string
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-fg-3">
        <Icon name={icon} size={14} />
        {label}
      </span>
      <span
        className="truncate-1 inline-flex min-w-0 items-center gap-1.75 font-semibold"
        style={{ color }}
      >
        <Dot color={color} size={7} glow={false} />
        {value}
      </span>
    </div>
  )
}

const KIND_COLOR: Record<string, string> = {
  nvidia: '#76b900',
  apple: 'var(--ac-sky)',
  amd: '#ed1c24',
  intel: '#0071c5',
  cpu: 'var(--text3)'
}

export function SetupScreen(): JSX.Element {
  const L = useDict()
  const compute = useCompute()
  const { inputs, outputs } = useAudioDevices()
  const health = useHealth()
  const serviceConfig = useServiceConfig()
  const resources = useResources(health.isSuccess)
  const active = useSessionStore((s) => s.active)
  const sessionMicLevel = useSessionStore((s) => s.micLevel)
  const systemLevel = useSessionStore((s) => s.systemLevel)
  const systemCapturing = useSessionStore((s) => s.systemCapturing)

  const inputDeviceId = useUiStore((s) => s.inputDeviceId)
  const outputDeviceId = useUiStore((s) => s.outputDeviceId)
  const virtualMicDeviceId = useUiStore((s) => s.virtualMicDeviceId)
  const setInputDeviceId = useUiStore((s) => s.setInputDeviceId)
  const setOutputDeviceId = useUiStore((s) => s.setOutputDeviceId)
  const setVirtualMicDeviceId = useUiStore((s) => s.setVirtualMicDeviceId)

  const [testing, setTesting] = useState(false)
  // Khi phiên đang chạy, mic đã được SessionController thu — không mở stream thứ hai.
  const previewLevel = useMicLevel(inputDeviceId, !active)
  const micLevel = active ? sessionMicLevel : previewLevel

  const serviceStages = serviceConfig.data?.stages ?? []
  const outputLabel = outputs.find((d) => d.deviceId === outputDeviceId)?.label ?? ''
  const virtualMics = outputs.filter((d) => looksLikeVirtualMic(d.label))
  const vmicSelected = virtualMicDeviceId !== ''

  const loop = !outputLabel
    ? { tone: 'warn' as const, icon: 'warning' as IconName, msg: L.loopUnknown }
    : looksLikeHeadphones(outputLabel)
      ? { tone: 'ok' as const, icon: 'check-circle' as IconName, msg: L.loopOk }
      : { tone: 'warn' as const, icon: 'warning' as IconName, msg: L.loopWarnSetup }

  const test = async (deviceId: string): Promise<void> => {
    setTesting(true)
    await playTestTone(deviceId)
    window.setTimeout(() => setTesting(false), 500)
  }

  return (
    <div className={SCREEN}>
      <ScreenHeader
        icon="sliders"
        title={L.setup}
        subtitle={L.setupSub}
        color="#fb923c"
        tint="rgba(251,146,60,.12)"
      />

      <div className="grid grid-cols-2 gap-3.5">
        <DeviceCard
          icon="mic"
          color="#22c55e"
          title={L.micCard}
          role={L.micRole}
          status={{
            text: inputs.length ? L.active : L.noDevice,
            color: inputs.length ? 'var(--ac-grn)' : 'var(--text4)'
          }}
          devices={inputs}
          value={inputDeviceId}
          onChange={setInputDeviceId}
          level={micLevel * 4}
          L={L}
        />
        <DeviceCard
          icon="monitor"
          color="#22d3ee"
          title={L.sysCard}
          role={L.sysRole}
          status={{
            text: systemCapturing ? L.sysCapturing : L.ready,
            color: systemCapturing ? 'var(--ac-grn)' : 'var(--text4)'
          }}
          devices={[]}
          value=""
          readOnly
          hint={L.sysHint}
          level={systemLevel * 4}
          L={L}
        />
        <DeviceCard
          icon="speaker"
          color="#fb923c"
          title={L.spkCard}
          role={L.spkRole}
          status={{
            text: outputs.length ? L.ready : L.noDevice,
            color: outputs.length ? 'var(--ac-grn)' : 'var(--text4)'
          }}
          devices={outputs}
          value={outputDeviceId}
          onChange={setOutputDeviceId}
          level={testing ? 0.7 : 0}
          onTest={() => void test(outputDeviceId)}
          L={L}
        />
        <DeviceCard
          icon="mic-dot"
          color="#d946ef"
          title={L.vmicCard}
          role={L.vmicRole}
          status={{
            text: vmicSelected ? L.connected : L.noDevice,
            color: vmicSelected ? 'var(--ac-grn)' : 'var(--text4)'
          }}
          devices={virtualMics.length ? virtualMics : outputs}
          value={virtualMicDeviceId}
          onChange={setVirtualMicDeviceId}
          level={0}
          onTest={() => void test(virtualMicDeviceId)}
          L={L}
        />
      </div>

      {/* phần cứng phát hiện được */}
      <div className="panel px-5 py-4.5">
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex text-[#a855f7]">
              <Icon name="chip" size={17} />
            </span>
            <div>
              <div className="text-md font-bold">{L.instanceT}</div>
              <div className="mt-px text-sm text-fg-3">{L.instanceSub}</div>
            </div>
          </div>
          {!compute && (
            <span className="inline-flex items-center gap-2 text-sm text-fg-3">
              <span className="flex text-[#22d3ee]">
                <Icon name="spinner" size={13} strokeWidth={2.6} spin />
              </span>
              {L.detecting}
            </span>
          )}
        </div>

        {compute && (
          <>
            <div className="mt-4 grid grid-cols-4 gap-2.5">
              <HwTile
                label={L.gpuLbl}
                value={prettyGpuName(compute.gpuRenderer) || L.notAvail}
                color={KIND_COLOR[compute.kind]}
              />
              <HwTile
                label={L.cpuLbl}
                value={
                  resources.data
                    ? `${resources.data.cpuCount} ${L.cores}`
                    : compute.cpuCores
                      ? `${compute.cpuCores} ${L.cores}`
                      : '—'
                }
              />
              <HwTile
                label={L.ramLbl}
                value={
                  resources.data
                    ? `${(resources.data.systemTotalMb / 1024).toFixed(0)} GB`
                    : compute.ramGb
                      ? `≥${compute.ramGb} GB`
                      : '—'
                }
              />
              <HwTile label={L.apiLbl} value={compute.webgpu ? 'WebGPU + WebGL' : 'WebGL'} />
            </div>

            {/* thiết bị tính toán THẬT của từng khâu, do service báo về */}
            <div
              className="mt-3 grid gap-2.5"
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, serviceStages.length)}, minmax(0,1fr))`
              }}
            >
              {serviceStages.map((stage) => {
                const color = STAGE_COLORS[stage.stage] ?? 'var(--text3)'
                return (
                  <div
                    key={stage.stage}
                    className="flex flex-col items-start gap-2 rounded-[13px] border p-3.5"
                    style={{ borderColor: `${color}55`, background: `${color}12` }}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-2xs font-bold tracking-[0.6px]" style={{ color }}>
                        {stage.stage}
                      </span>
                      {stage.loaded && (
                        <span className="flex" style={{ color }}>
                          <Icon name="check" size={14} strokeWidth={2.6} />
                        </span>
                      )}
                    </div>
                    <div className="text-md leading-tight font-bold">{stage.accel}</div>
                    <div className="truncate-1 max-w-full font-mono text-[10px] text-fg-4">
                      {stage.adapter}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-3 flex items-center gap-2.25 rounded-[11px] border border-line-soft bg-inset px-3.25 py-2.5 text-sm text-fg-3">
              <Badge color={KIND_COLOR[compute.kind]}>{compute.kind}</Badge>
              <span className="flex-1">
                {serviceStages.length > 0 ? L.computeFromService : L.computeReadOnly}
              </span>
            </div>
          </>
        )}
      </div>

      {/* trạng thái + gợi ý */}
      <div className="flex flex-wrap gap-3.5">
        <div className="panel min-w-70 flex-1 px-4.5 py-4">
          <div className="mb-3 text-base font-bold">{L.sysStatus}</div>
          <div className="flex flex-col gap-2.5 text-base">
            <StatusRow
              icon="box"
              label={L.models}
              value={
                health.isSuccess && serviceConfig.data
                  ? `${L.loadedLbl} · ${PRESET_META[serviceConfig.data.preset].name}`
                  : L.loadIdle
              }
              color={health.isSuccess ? 'var(--ac-grn)' : 'var(--text4)'}
            />
            <StatusRow
              icon="chip"
              label={L.compute}
              value={compute ? `${compute.kind} · ${compute.recommended}` : L.detecting}
              color="var(--ac-sky)"
            />
            <StatusRow
              icon="mic"
              label={L.vmicStatus}
              value={outputs.find((d) => d.deviceId === virtualMicDeviceId)?.label ?? L.noDevice}
              color={vmicSelected ? 'var(--ac-grn)' : 'var(--text4)'}
            />
          </div>
        </div>

        <div className="flex min-w-70 flex-1 gap-3 rounded-2xl border border-[rgba(251,146,60,.25)] bg-[rgba(251,146,60,.06)] px-4.5 py-4 backdrop-blur-xl">
          <span className="mt-0.5 flex text-[#fb923c]">
            <Icon name="warning" size={20} />
          </span>
          <div>
            <div className="mb-1.25 text-base font-bold text-ac-org-2">{L.tipTitle}</div>
            <div className="text-sm leading-normal text-ac-org">
              {L.tipBody}
              {PLATFORM === 'darwin'
                ? ' (BlackHole 2ch)'
                : PLATFORM === 'win32'
                  ? ' (VB-CABLE)'
                  : ''}
            </div>
          </div>
        </div>
      </div>

      <Notice tone={loop.tone} icon={loop.icon} title={L.loopCheckT} body={loop.msg} />
    </div>
  )
}
