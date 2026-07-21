// Adapter: phát TTS ra loa bằng WebAudio, xếp lịch tuần tự (không chồng tiếng).
//
// Mỗi đoạn PCM16 mono được dựng thành AudioBuffer ở đúng sampleRate của model
// (WebAudio tự resample về sampleRate của AudioContext) và start nối đuôi đoạn trước.

import type { AudioOutput, TtsChunk } from '../ports/audio-output'

export class TtsPlayer implements AudioOutput {
  private ctx: AudioContext | null = null
  private nextTime = 0
  private sources = new Set<AudioBufferSourceNode>()

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
    }
    // Trình duyệt có thể tạm dừng AudioContext tới khi có tương tác người dùng.
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }
}
