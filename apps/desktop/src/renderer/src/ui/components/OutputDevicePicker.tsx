import { useEffect, useState, type JSX } from 'react'
import {
  listOutputDevices,
  looksLikeVirtualMic,
  type AudioDevice
} from '../../adapters/audio-devices'
import { useSessionStore } from '../../stores/session-store'
import { Select, type Option } from './Select'

// Chọn thiết bị đầu ra cho TTS. Để Google Meet nhận giọng dịch, chọn microphone ảo
// (BlackHole trên macOS, VB-CABLE trên Windows) rồi đặt thiết bị đó làm micro trong Meet.
export function OutputDevicePicker(): JSX.Element {
  const outputDeviceId = useSessionStore((s) => s.outputDeviceId)
  const setOutputDeviceId = useSessionStore((s) => s.setOutputDeviceId)
  const active = useSessionStore((s) => s.active)
  const [devices, setDevices] = useState<AudioDevice[]>([])

  useEffect(() => {
    let alive = true
    const load = async (): Promise<void> => {
      const list = await listOutputDevices()
      if (alive) setDevices(list)
    }
    void load()
    navigator.mediaDevices.addEventListener('devicechange', load)
    return () => {
      alive = false
      navigator.mediaDevices.removeEventListener('devicechange', load)
    }
  }, [])

  const refresh = async (): Promise<void> => setDevices(await listOutputDevices())

  const options: Option<string>[] = [
    { value: '', label: 'Mặc định hệ điều hành' },
    ...devices.map((d) => ({
      value: d.deviceId,
      label: looksLikeVirtualMic(d.label) ? `🎙️ ${d.label} (mic ảo)` : d.label
    }))
  ]

  const selected = devices.find((d) => d.deviceId === outputDeviceId)
  const isVirtual = selected ? looksLikeVirtualMic(selected.label) : false

  return (
    <div className="space-y-2">
      <Select
        label="Thiết bị đầu ra TTS"
        value={outputDeviceId}
        options={options}
        disabled={active}
        onChange={setOutputDeviceId}
      />
      <button
        onClick={() => void refresh()}
        disabled={active}
        className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40"
      >
        ↻ Làm mới danh sách thiết bị
      </button>
      {outputDeviceId !== '' && !isVirtual && (
        <p className="text-xs text-amber-300">
          Thiết bị này không giống microphone ảo. Google Meet chỉ nhận được giọng dịch nếu bạn chọn
          BlackHole (macOS) hoặc VB-CABLE (Windows).
        </p>
      )}
    </div>
  )
}
