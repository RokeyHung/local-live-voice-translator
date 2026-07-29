// Adapter: liệt kê thiết bị âm thanh (micro vào, loa/tai nghe ra, microphone ảo).
//
// enumerateDevices() chỉ trả label khi đã có quyền truy cập audio; nếu label rỗng
// ta xin quyền micro một lần (nhẹ) rồi liệt kê lại — không giữ stream.

export interface AudioDevice {
  deviceId: string
  label: string
}

async function unlockLabels(): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
  } catch {
    // Người dùng từ chối — vẫn liệt kê được deviceId, chỉ thiếu label.
  }
}

async function list(kind: MediaDeviceKind): Promise<AudioDevice[]> {
  let devices = await navigator.mediaDevices.enumerateDevices()
  let matching = devices.filter((d) => d.kind === kind)
  if (matching.some((d) => d.label === '')) {
    await unlockLabels()
    devices = await navigator.mediaDevices.enumerateDevices()
    matching = devices.filter((d) => d.kind === kind)
  }
  return matching.map((d) => ({
    deviceId: d.deviceId,
    label: d.label || `Thiết bị ${d.deviceId.slice(0, 8)}`
  }))
}

export function listOutputDevices(): Promise<AudioDevice[]> {
  return list('audiooutput')
}

export function listInputDevices(): Promise<AudioDevice[]> {
  return list('audioinput')
}

// Gợi ý tên microphone ảo phổ biến theo nền tảng (giúp người dùng chọn đúng).
export function looksLikeVirtualMic(label: string): boolean {
  return /blackhole|vb-?cable|cable input|voicemeeter|loopback|soundflower/i.test(label)
}

// Tai nghe/earbud không gây vọng âm; loa ngoài thì có → dùng để cảnh báo vòng lặp.
export function looksLikeHeadphones(label: string): boolean {
  return /airpod|headphone|headset|earbud|earphone|tai nghe|buds/i.test(label)
}

// Phát một tiếng bíp ngắn ra thiết bị đang chọn để kiểm tra đầu ra.
export async function playTestTone(deviceId: string): Promise<void> {
  const ctx = new AudioContext()
  const sinkable = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> }
  if (deviceId && typeof sinkable.setSinkId === 'function') {
    try {
      await sinkable.setSinkId(deviceId)
    } catch {
      // Thiết bị không nhận sink — vẫn phát ra thiết bị mặc định.
    }
  }
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = 660
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.5)
  osc.onended = (): void => void ctx.close()
}
