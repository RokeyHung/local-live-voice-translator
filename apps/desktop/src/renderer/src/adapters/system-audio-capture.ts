// Adapter: thu âm thanh hệ thống (giọng phía cuộc họp) làm nguồn incoming.
//
// Đi qua getDisplayMedia — main process đã cài setDisplayMediaRequestHandler để
// trả về luồng loopback (ScreenCaptureKit trên macOS 13+, WASAPI loopback trên
// Windows). Chromium bắt buộc yêu cầu kèm video, nên ta xin video rồi bỏ ngay
// track đó: chỉ giữ audio.

import type { AudioCapture, AudioFrame } from '../ports/audio-capture'
import { Pcm16Stream } from './pcm16-stream'

export class SystemAudioCaptureError extends Error {}

export class SystemAudioCapture implements AudioCapture {
  private readonly pcm = new Pcm16Stream()

  async start(onFrame: (frame: AudioFrame) => void): Promise<void> {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    } catch (err) {
      // Người dùng từ chối, hoặc macOS chưa cấp quyền Ghi màn hình cho ứng dụng.
      throw new SystemAudioCaptureError(
        `Không thu được âm thanh hệ thống: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    // Không dùng hình ảnh — tắt ngay để không tốn tài nguyên và không hiện chỉ
    // báo "đang chia sẻ màn hình" lâu hơn mức cần thiết.
    stream.getVideoTracks().forEach((track) => {
      track.stop()
      stream.removeTrack(track)
    })

    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach((t) => t.stop())
      throw new SystemAudioCaptureError(
        'Nguồn đã chọn không có âm thanh — cần bật loopback hoặc chọn nguồn có tiếng.'
      )
    }

    await this.pcm.attach(stream, onFrame)
  }

  stop(): void {
    this.pcm.stop()
  }
}
