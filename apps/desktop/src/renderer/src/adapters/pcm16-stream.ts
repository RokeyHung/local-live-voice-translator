// Hạ tầng dùng chung cho mọi nguồn thu: MediaStream → khung PCM signed 16-bit,
// mono, 16 kHz — đúng định dạng ASR yêu cầu.
//
// AudioContext được ép sampleRate=16000 nên không cần resample thủ công. Một
// AudioWorklet gom mẫu thành khung ~100 ms rồi chuyển Float32 → Int16.

import type { AudioFrame } from '../ports/audio-capture'

export const TARGET_SAMPLE_RATE = 16000
export const FRAME_SAMPLES = 1600 // 100 ms @ 16 kHz (trong khoảng 20–100 ms của contract)

// Mã AudioWorklet nạp qua Blob URL để khỏi cấu hình entry riêng cho electron-vite.
const WORKLET_CODE = `
class Pcm16Capture extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this._size = options.processorOptions.frameSamples
    this._buf = new Float32Array(this._size)
    this._n = 0
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this._buf[this._n++] = ch[i]
        if (this._n === this._size) {
          const pcm = new Int16Array(this._size)
          for (let j = 0; j < this._size; j++) {
            const s = Math.max(-1, Math.min(1, this._buf[j]))
            pcm[j] = s < 0 ? s * 0x8000 : s * 0x7fff
          }
          this.port.postMessage(pcm.buffer, [pcm.buffer])
          this._n = 0
        }
      }
    }
    return true
  }
}
registerProcessor('pcm16-capture', Pcm16Capture)
`

// Bọc một MediaStream đang chạy thành luồng khung PCM16. Người gọi tự lo việc
// lấy stream (getUserMedia cho mic, getDisplayMedia cho âm thanh hệ thống).
export class Pcm16Stream {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private node: AudioWorkletNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private workletUrl: string | null = null

  async attach(stream: MediaStream, onFrame: (frame: AudioFrame) => void): Promise<void> {
    this.stream = stream

    const ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })
    this.workletUrl = URL.createObjectURL(
      new Blob([WORKLET_CODE], { type: 'application/javascript' })
    )
    await ctx.audioWorklet.addModule(this.workletUrl)

    const source = ctx.createMediaStreamSource(stream)
    const node = new AudioWorkletNode(ctx, 'pcm16-capture', {
      processorOptions: { frameSamples: FRAME_SAMPLES }
    })
    node.port.onmessage = (ev): void => {
      onFrame({ pcm: new Int16Array(ev.data as ArrayBuffer), sampleRate: ctx.sampleRate })
    }
    source.connect(node)

    this.ctx = ctx
    this.node = node
    this.source = source
  }

  stop(): void {
    this.node?.port.close()
    this.source?.disconnect()
    this.node?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    void this.ctx?.close()
    if (this.workletUrl) URL.revokeObjectURL(this.workletUrl)
    this.ctx = this.node = this.source = this.stream = this.workletUrl = null
  }
}
