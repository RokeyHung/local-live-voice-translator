// Adapter: đo mức tín hiệu (RMS) của một thiết bị đầu vào để hiển thị thanh mức.
//
// Chỉ dùng cho việc kiểm tra thiết bị ở màn Thiết lập. Khi phiên đang chạy, mức
// tín hiệu được tính trực tiếp từ khung PCM mà SessionController đã thu.

export class LevelMeter {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private raf = 0

  async start(deviceId: string, onLevel: (level: number) => void): Promise<void> {
    this.stop()
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true
    })
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    ctx.createMediaStreamSource(this.stream).connect(analyser)
    const buf = new Float32Array(analyser.fftSize)

    const tick = (): void => {
      analyser.getFloatTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
      onLevel(Math.sqrt(sum / buf.length))
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
    this.ctx = ctx
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.stream?.getTracks().forEach((t) => t.stop())
    void this.ctx?.close()
    this.ctx = null
    this.stream = null
  }
}

// RMS (0..1) → dBFS để hiển thị; dưới ngưỡng nghe được thì trả về null (-∞).
export function rmsToDb(rms: number): number | null {
  if (rms <= 0.0005) return null
  return Math.round(20 * Math.log10(rms))
}
