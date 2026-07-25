// Adapter: phát TTS ra thiết bị đầu ra bằng WebAudio, xếp lịch tuần tự (không chồng tiếng).
//
// Mỗi đoạn PCM16 mono được dựng thành AudioBuffer ở đúng sampleRate của model
// (WebAudio tự resample về sampleRate của AudioContext) và start nối đuôi đoạn trước.
//
// setSink() trỏ đầu ra tới một thiết bị cụ thể (vd microphone ảo BlackHole/VB-CABLE)
// qua AudioContext.setSinkId — nhờ đó Google Meet nhận âm thanh TTS như micro.

import type { AudioOutput, TtsChunk } from '../ports/audio-output'

// AudioContext.setSinkId/sinkId chưa có trong lib.dom mọi phiên bản TS → khai báo hẹp.
type SinkableContext = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>
  sinkId?: string
}

export class TtsPlayer implements AudioOutput {
  private ctx: AudioContext | null = null
  private nextTime = 0
  private sources = new Set<AudioBufferSourceNode>()
  private sinkId = '' // '' = thiết bị mặc định

  async setSink(deviceId: string): Promise<void> {
    this.sinkId = deviceId
    // Nếu context đã tạo, áp dụng ngay; nếu chưa, ensureCtx() sẽ áp dụng khi tạo.
    if (this.ctx) await this.applySink(this.ctx as SinkableContext)
  }

  play(chunk: TtsChunk): void {
    if (chunk.pcm.length === 0) return
    const ctx = this.ensureCtx()

    const buffer = ctx.createBuffer(1, chunk.pcm.length, chunk.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < chunk.pcm.length; i++) data[i] = chunk.pcm[i] / 32768

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    src.onended = (): void => {
      this.sources.delete(src)
    }

    const start = Math.max(ctx.currentTime, this.nextTime)
    src.start(start)
    this.nextTime = start + buffer.duration
    this.sources.add(src)
  }

  stop(): void {
    for (const src of this.sources) {
      try {
        src.stop()
      } catch {
        // đã dừng
      }
    }
    this.sources.clear()
    this.nextTime = this.ctx ? this.ctx.currentTime : 0
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.nextTime = this.ctx.currentTime
      if (this.sinkId) void this.applySink(this.ctx as SinkableContext)
    }
    // Trình duyệt có thể tạm dừng AudioContext tới khi có tương tác người dùng.
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private async applySink(ctx: SinkableContext): Promise<void> {
    if (typeof ctx.setSinkId !== 'function') {
      console.warn('AudioContext.setSinkId không khả dụng — dùng thiết bị mặc định')
      return
    }
    if (ctx.sinkId === this.sinkId) return
    try {
      await ctx.setSinkId(this.sinkId)
    } catch (err) {
      console.error('setSinkId thất bại:', err)
    }
  }
}
