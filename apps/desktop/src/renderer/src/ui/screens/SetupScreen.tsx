// Màn Thiết bị âm thanh: chọn/kiểm tra 4 đường tín hiệu, xem phần cứng phát hiện
// được và cảnh báo vòng lặp âm thanh.

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
import { PRESET_META } from '../../application/presets'
import type { ComputeBackend, ComputeKind } from '../../domain/enums'
import { useServiceConfig } from '../../hooks/use-config'
import { useHealth } from '../../hooks/use-health'
import { useAudioDevices, useCompute, useDict, useMicLevel } from '../../hooks/use-ui'
import { useSessionStore } from '../../stores/session-store'
import { useUiStore } from '../../stores/ui-store'
import { Icon, type IconName } from '../components/Icon'
import { Badge, Dot, Meter, Notice, ScreenHeader } from '../components/primitives'
import { LABEL, MONO, PANEL, selectStyle } from '../styles'

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
    <div
      style={{
        ...PANEL,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        opacity: disabled ? 0.6 : 1
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${color}24`,
            color
          }}
        >
          <Icon name={icon} size={17} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>{role}</div>
        </div>
        <Badge color={status.color}>{status.text}</Badge>
      </div>

      {disabled || readOnly ? (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--inset)',
            border: '1px dashed var(--line-strong)',
            fontSize: 12,
            color: 'var(--text4)',
            lineHeight: 1.45
          }}
        >
          {hint}
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          style={{ ...selectStyle, height: 38, width: '100%', fontSize: 12.5 }}
        >
          <option value="">{L.deviceDefault}</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Meter value={level ?? 0} color={color} />
        <button
          onClick={onTest}
          disabled={disabled || !onTest}
          title={disabled ? hint : undefined}
          style={{
            height: 30,
            padding: '0 13px',
            borderRadius: 8,
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--text)',
            background: 'var(--line-soft)',
            border: '1px solid var(--line-strong)',
            cursor: disabled || !onTest ? 'not-allowed' : 'pointer',
            opacity: disabled || !onTest ? 0.45 : 1
          }}
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
    <div
      style={{
        padding: '11px 13px',
        borderRadius: 11,
        background: 'var(--inset)',
        border: '1px solid var(--line-soft)',
        minWidth: 0
      }}
    >
      <div style={{ ...LABEL, fontSize: 9.5, letterSpacing: 0.5 }}>{label}</div>
      <div
        title={value}
        style={{
          fontSize: 12,
          fontWeight: 600,
          marginTop: 5,
          color: color ?? 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          ...MONO
        }}
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
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text3)' }}>
        <Icon name={icon} size={14} />
        {label}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          color,
          fontWeight: 600,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        <Dot color={color} size={7} glow={false} />
        {value}
      </span>
    </div>
  )
}

// Các backend suy luận mà ai-service có thể dùng; hiển thị chỉ-đọc — service tự
// chọn khi nạp model, giao diện chưa đổi được.
const BACKENDS: {
  id: ComputeBackend | 'auto'
  labelKey: 'devAuto' | 'devCuda' | 'devMetal' | 'devVulkan' | 'devCpu'
  subKey?: 'devAutoSub' | 'devCpuSub'
  color: string
  icon: IconName
  kinds: ComputeKind[]
}[] = [
  {
    id: 'auto',
    labelKey: 'devAuto',
    subKey: 'devAutoSub',
    color: '#22d3ee',
    icon: 'gear',
    kinds: []
  },
  { id: 'cuda', labelKey: 'devCuda', color: '#76b900', icon: 'chip', kinds: ['nvidia'] },
  { id: 'metal', labelKey: 'devMetal', color: '#38bdf8', icon: 'bolt', kinds: ['apple'] },
  { id: 'vulkan', labelKey: 'devVulkan', color: '#a855f7', icon: 'box', kinds: ['amd', 'intel'] },
  { id: 'cpu', labelKey: 'devCpu', subKey: 'devCpuSub', color: '#64748b', icon: 'chip', kinds: [] }
]

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
    <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader
        icon="sliders"
        title={L.setup}
        subtitle={L.setupSub}
        color="#fb923c"
        tint="rgba(251,146,60,.12)"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
            <span style={{ color: '#a855f7', display: 'flex' }}>
              <Icon name="chip" size={17} />
            </span>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{L.instanceT}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 1 }}>
                {L.instanceSub}
              </div>
            </div>
          </div>
          {!compute && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11.5,
                color: 'var(--text3)'
              }}
            >
              <span style={{ color: '#22d3ee', display: 'flex' }}>
                <Icon name="spinner" size={13} strokeWidth={2.6} spin />
              </span>
              {L.detecting}
            </span>
          )}
        </div>

        {compute && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
                gap: 10,
                marginTop: 16
              }}
            >
              <HwTile
                label={L.gpuLbl}
                value={prettyGpuName(compute.gpuRenderer) || L.notAvail}
                color={KIND_COLOR[compute.kind]}
              />
              <HwTile
                label={L.cpuLbl}
                value={compute.cpuCores ? `${compute.cpuCores} ${L.cores}` : '—'}
              />
              <HwTile
                label={L.ramLbl}
                value={compute.ramGb ? `${compute.ramCapped ? '≥' : ''}${compute.ramGb} GB` : '—'}
              />
              <HwTile label={L.apiLbl} value={compute.webgpu ? 'WebGPU + WebGL' : 'WebGL'} />
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, minmax(0,1fr))',
                gap: 10,
                marginTop: 12
              }}
            >
              {BACKENDS.map((backend) => {
                const available =
                  backend.id === 'auto' ||
                  backend.id === 'cpu' ||
                  backend.kinds.includes(compute.kind)
                const on = backend.id === compute.recommended
                return (
                  <div
                    key={backend.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      gap: 8,
                      padding: 14,
                      borderRadius: 13,
                      opacity: available ? 1 : 0.4,
                      border: `1px solid ${on ? backend.color : 'var(--line)'}`,
                      background: on ? `${backend.color}14` : 'var(--surface)',
                      boxShadow: on ? `0 0 14px ${backend.color}22` : 'none'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%'
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          width: 34,
                          height: 34,
                          borderRadius: 9,
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: `${backend.color}1a`,
                          color: backend.color
                        }}
                      >
                        <Icon name={backend.icon} size={18} />
                      </span>
                      {on && (
                        <span style={{ color: backend.color, display: 'flex' }}>
                          <Icon name="check" size={16} strokeWidth={2.6} />
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>
                      {L[backend.labelKey]}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text4)' }}>
                      {available
                        ? on
                          ? L.recommended
                          : backend.subKey
                            ? L[backend.subKey]
                            : ''
                        : L.notAvail}
                    </div>
                  </div>
                )
              })}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                marginTop: 12,
                padding: '10px 13px',
                borderRadius: 11,
                background: 'var(--inset)',
                border: '1px solid var(--line-soft)',
                fontSize: 11.5,
                color: 'var(--text3)'
              }}
            >
              <Badge color={KIND_COLOR[compute.kind]}>{compute.kind}</Badge>
              <span style={{ flex: 1 }}>{L.computeReadOnly}</span>
            </div>
          </>
        )}
      </div>

      {/* trạng thái + gợi ý */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...PANEL, flex: 1, minWidth: 280, padding: '16px 18px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 12 }}>{L.sysStatus}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5 }}>
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

        <div
          style={{
            flex: 1,
            minWidth: 280,
            borderRadius: 16,
            border: '1px solid rgba(251,146,60,.25)',
            background: 'rgba(251,146,60,.06)',
            backdropFilter: 'blur(20px)',
            padding: '16px 18px',
            display: 'flex',
            gap: 12
          }}
        >
          <span style={{ color: '#fb923c', display: 'flex', marginTop: 2 }}>
            <Icon name="warning" size={20} />
          </span>
          <div>
            <div
              style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ac-org2)', marginBottom: 5 }}
            >
              {L.tipTitle}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ac-org)', lineHeight: 1.5 }}>
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
