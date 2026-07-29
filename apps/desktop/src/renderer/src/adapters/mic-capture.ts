// Adapter: thu microphone vật lý qua WebAudio, xuất PCM signed 16-bit mono 16 kHz.
// Phần chuyển đổi khung nằm ở Pcm16Stream (dùng chung với thu âm thanh hệ thống).

import type { AudioCapture, AudioFrame } from '../ports/audio-capture'
import { Pcm16Stream } from './pcm16-stream'

export class MicCapture implements AudioCapture {
  private readonly pcm = new Pcm16Stream()

  async start(onFrame: (frame: AudioFrame) => void, deviceId = ''): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {})
      }
    })
    await this.pcm.attach(stream, onFrame)
  }

  stop(): void {
    this.pcm.stop()
  }
}
