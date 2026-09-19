// Màn Thiết bị âm thanh: chọn/kiểm tra 3 đường tín hiệu, xem phần cứng và thiết
// bị tính toán thật của từng khâu, cảnh báo vòng lặp âm thanh.
//
// Đường thứ tư — microphone ảo đẩy tiếng dịch vào Google Meet — đã bỏ khỏi phạm vi
// đồ án (chốt với GVHD): ứng dụng chỉ dịch và phát ra loa/tai nghe, không tích hợp
// với phần mềm họp nào. Phần hiện thực vẫn còn (`TtsPlayer.setSink`,
// `looksLikeVirtualMic`, `uiStore.virtualMicDeviceId`) nên bật lại chỉ là dựng lại
// thẻ chọn thiết bị ở đây.

import { useState, type JSX } from 'react'
import { looksLikeHeadphones, playTestTone, type AudioDevice } from '../../adapters/audio-devices'
import { prettyGpuName } from '../../adapters/compute-probe'
import type { Dict } from '../../application/i18n'
import { PRESET_META } from '../../application/presets'
import { useResources, useServiceConfig } from '../../hooks/use-config'
import { useHealth } from '../../hooks/use-health'
import { useAudioDevices, useCompute, useDict, useIsScreen, useMicLevel } from '../../hooks/use-ui'
import { useSessionStore } from '../../stores/session-store'
import { useUiStore } from '../../stores/ui-store'
import { Icon, type IconName } from '../components/Icon'
import { Badge, Dot, Meter, ScreenHeader } from '../components/primitives'
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
  color,
  mono = true
}: {
  label: string
  value: string
  color?: string
  mono?: boolean
}): JSX.Element {
  return (
    <div className="min-w-0 rounded-[11px] border border-line-soft bg-inset px-3.25 py-2.75">
      <div className="label-caps text-2xs tracking-[0.5px]">{label}</div>
      <div
        title={value}
        className={`truncate-1 mt-1.25 text-[12px] font-semibold ${mono ? 'font-mono' : ''}`}
        style={{ color: color ?? 'var(--text)' }}
      >
        {value}
      </div>
    </div>
  )
}

// Năm thiết bị tính toán của thiết kế. Ứng dụng KHÔNG chọn được backend (AI service
// tự quyết lúc nạp model) nên các ô này chỉ để đọc: ô nào trùng với `accel` service
// đang báo về thì đánh dấu "đang dùng", ô nào máy không có thì mờ đi.
interface ComputeTileDef {
  id: string
  icon: IconName
  color: string
  label: (L: Dict) => string
  sub: (L: Dict) => string
  available: (kind: string) => boolean
}

const COMPUTE_TILES: ComputeTileDef[] = [
  {
    id: 'auto',
    icon: 'sun',
    color: '#22d3ee',
    label: (L) => L.devAuto,
    sub: (L) => L.devAutoSub,
    available: () => true
  },
  {
    id: 'cuda',
    icon: 'chip',
    color: '#76b900',
    label: (L) => L.devCuda,
    sub: () => '',
    available: (kind) => kind === 'nvidia'
  },
  {
    id: 'metal',
    icon: 'apple',
    color: '#38bdf8',
    label: (L) => L.devMetal,
    sub: () => '',
    available: (kind) => kind === 'apple'
  },
  {
    id: 'vulkan',
    icon: 'box',
    color: '#a855f7',
    label: (L) => L.devVulkan,
    sub: () => '',
    // Vulkan nằm trong driver của cả NVIDIA — bản cài Windows chạy whisper.cpp qua
    // Vulkan trên mọi card (tools/build_whisper_vulkan.sh).
    available: (kind) => kind === 'nvidia' || kind === 'amd' || kind === 'intel'
  },
  {
    id: 'cpu',
    icon: 'chip',
    color: '#64748b',
    label: (L) => L.devCpu,
    sub: (L) => L.devCpuSub,
    available: () => true
  }
]

/** Tên bộ tăng tốc service báo về ("Metal", "CUDA", "mps", "BLAS"…) → ô tương ứng. */
function tileOfAccel(accel: string): string {
  const a = accel.toLowerCase()
  if (a.includes('metal') || a.includes('mps')) return 'metal'
  if (a.includes('cuda')) return 'cuda'
  if (a.includes('vulkan')) return 'vulkan'
  return 'cpu'
}

function ComputeTile({
  icon,
  color,
  label,
  sub,
  available,
  inUse,
  recommended,
  hint,
  L
}: {
  icon: IconName
  color: string
  label: string
  sub: string
  available: boolean
  inUse: boolean
  recommended: boolean
  hint: string
  L: Dict
}): JSX.Element {
  return (
    <div
      title={hint}
      className={`flex flex-col items-start gap-2 rounded-[13px] border p-3.5 ${available ? '' : 'opacity-40'}`}
      style={{
        borderColor: inUse ? color : 'var(--line)',
        background: inUse ? `${color}14` : 'var(--surface)',
        ...(inUse ? { boxShadow: `0 0 14px ${color}22` } : {})
      }}
    >
      <div className="flex w-full items-center justify-between">
        <span
          className="inline-flex size-8.5 items-center justify-center rounded-[9px]"
          style={{ background: `${color}1a`, color }}
        >
          <Icon name={icon} size={18} />
        </span>
        {inUse ? (
          <span className="flex" style={{ color }} title={L.devInUse}>
            <Icon name="check" size={16} strokeWidth={2.6} />
          </span>
        ) : (
          recommended && (
            <span
              className="rounded-full px-1.5 py-0.5 text-3xs font-bold"
              style={{ color, background: `${color}1a` }}
            >
              {L.recommended}
            </span>
          )
        )}
      </div>
      <div className="text-[12px] leading-tight font-bold">{label}</div>
      <div className="text-[10px] text-fg-4">{available ? sub : L.notAvail}</div>
    </div>
  )
}

const LOOP_TONE = {
  ok: {
    color: 'var(--ac-grn)',
    border: 'rgba(34,197,94,.25)',
    bg: 'rgba(34,197,94,.06)',
    tint: 'rgba(34,197,94,.14)'
  },
  warn: {
    color: 'var(--ac-org2)',
    border: 'rgba(251,146,60,.3)',
    bg: 'rgba(251,146,60,.07)',
    tint: 'rgba(251,146,60,.14)'
  }
} as const

// Thẻ kiểm tra vòng lặp âm thanh, khép lại màn hình: xanh khi đầu ra là tai nghe,
// cam khi loa ngoài có thể vọng ngược vào mic. Màu tính theo kết quả nên đi qua
// `style` chứ không phải class.
function LoopCard({
  tone,
  icon,
  title,
  message
}: {
  tone: keyof typeof LOOP_TONE
  icon: IconName
  title: string
  message: string
}): JSX.Element {
  const palette = LOOP_TONE[tone]
  return (
    <div
      className="flex items-center gap-3.25 rounded-2xl border px-4.5 py-4 backdrop-blur-xl"
      style={{ borderColor: palette.border, background: palette.bg }}
    >
      <span
        className="flex size-8.5 shrink-0 items-center justify-center rounded-md"
        style={{ background: palette.tint, color: palette.color }}
      >
        <Icon name={icon} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-base font-bold" style={{ color: palette.color }}>
          {title}
        </div>
        <div className="mt-0.75 text-sm leading-snug text-fg-3">{message}</div>
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
  const visible = useIsScreen('setup')
  const resources = useResources(health.isSuccess && visible)
  const active = useSessionStore((s) => s.active)
  const sessionMicLevel = useSessionStore((s) => s.micLevel)
  const systemLevel = useSessionStore((s) => s.systemLevel)
  const systemCapturing = useSessionStore((s) => s.systemCapturing)

  const inputDeviceId = useUiStore((s) => s.inputDeviceId)
  const outputDeviceId = useUiStore((s) => s.outputDeviceId)
  const setInputDeviceId = useUiStore((s) => s.setInputDeviceId)
  const setOutputDeviceId = useUiStore((s) => s.setOutputDeviceId)

  const [testing, setTesting] = useState(false)
  // Khi phiên đang chạy, mic đã được SessionController thu — không mở stream thứ hai.
  const previewLevel = useMicLevel(inputDeviceId, !active)
  const micLevel = active ? sessionMicLevel : previewLevel

  const serviceStages = serviceConfig.data?.stages ?? []
  // Khâu nào đã nạp thì `accel` là bộ tăng tốc THẬT đang chạy — dùng nó để đánh dấu
  // ô thiết bị, chứ không suy từ phần cứng máy.
  const accelsInUse = new Set(
    serviceStages.filter((s) => s.loaded).map((s) => tileOfAccel(s.accel))
  )
  // Đã có khâu chạy GPU (vd. Vulkan trên card NVIDIA) thì đừng gợi ý ô GPU khác nữa.
  const gpuInUse = ['cuda', 'metal', 'vulkan'].some((id) => accelsInUse.has(id))
  const outputLabel = outputs.find((d) => d.deviceId === outputDeviceId)?.label ?? ''

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
        {/* Còn ba đường tín hiệu nên ô loa chiếm trọn hàng thứ hai. */}
        <div className="col-span-2">
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
        </div>
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
                mono={false}
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

            {/* thiết bị tính toán — chỉ để đọc, dấu tích là accel THẬT service báo về */}
            <div className="mt-3 grid grid-cols-5 gap-2.5">
              {COMPUTE_TILES.map((tile) => {
                const available = tile.available(compute.kind)
                const inUse = accelsInUse.has(tile.id)
                return (
                  <ComputeTile
                    key={tile.id}
                    icon={tile.icon}
                    color={tile.color}
                    label={tile.label(L)}
                    sub={tile.sub(L)}
                    available={available}
                    inUse={inUse}
                    recommended={
                      available &&
                      !inUse &&
                      !gpuInUse &&
                      ((compute.kind === 'nvidia' && tile.id === 'cuda') ||
                        (compute.kind === 'apple' && tile.id === 'metal'))
                    }
                    hint={L.computeReadOnly}
                    L={L}
                  />
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
              icon="speaker"
              label={L.spkCard}
              value={outputLabel || L.noDevice}
              color={outputLabel ? 'var(--ac-grn)' : 'var(--text4)'}
            />
          </div>
        </div>
      </div>

      <LoopCard tone={loop.tone} icon={loop.icon} title={L.loopCheckT} message={loop.msg} />
    </div>
  )
}
