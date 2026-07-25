// Adapter: liệt kê thiết bị âm thanh đầu ra (loa/tai nghe/microphone ảo).
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

export async function listOutputDevices(): Promise<AudioDevice[]> {
  let devices = await navigator.mediaDevices.enumerateDevices()
  let outputs = devices.filter((d) => d.kind === 'audiooutput')
  if (outputs.some((d) => d.label === '')) {
    await unlockLabels()
    devices = await navigator.mediaDevices.enumerateDevices()
    outputs = devices.filter((d) => d.kind === 'audiooutput')
  }
  return outputs.map((d) => ({
    deviceId: d.deviceId,
    label: d.label || `Thiết bị ${d.deviceId.slice(0, 8)}`
  }))
}

// Gợi ý tên microphone ảo phổ biến theo nền tảng (giúp người dùng chọn đúng).
export function looksLikeVirtualMic(label: string): boolean {
  return /blackhole|vb-?cable|cable input|voicemeeter|loopback|soundflower/i.test(label)
}
