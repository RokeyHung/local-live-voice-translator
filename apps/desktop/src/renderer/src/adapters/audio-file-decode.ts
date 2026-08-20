// Adapter: tệp âm thanh trên đĩa → PCM signed 16-bit, mono, 16 kHz (định dạng ASR).
//
// Giải mã bằng Web Audio của Chromium nên đọc được MP3, WAV, M4A/AAC, FLAC, OGG,
// WebM/Opus mà không phải đóng gói ffmpeg kèm ứng dụng — và vẫn chạy hoàn toàn cục
// bộ, đúng nguyên tắc của dự án. AI service vì thế chỉ nhận PCM đã chuẩn hoá.
//
// `decodeAudioData` resample về đúng sampleRate của context, nên chỉ còn phải trộn
// các kênh về mono và đổi Float32 → Int16.

import { TARGET_SAMPLE_RATE } from './pcm16-stream'

export interface DecodedAudio {
  pcm: ArrayBuffer // PCM 16-bit little-endian, mono, 16 kHz
  durationMs: number
}

export class AudioFileDecodeError extends Error {}

function toMonoInt16(buffer: AudioBuffer): ArrayBuffer {
  const channels = buffer.numberOfChannels
  const length = buffer.length
  const out = new Int16Array(length)
  const first = buffer.getChannelData(0)

  if (channels === 1) {
    for (let i = 0; i < length; i++) {
      const s = Math.max(-1, Math.min(1, first[i]))
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return out.buffer
  }

  // Nhiều kênh: lấy trung bình. Chia cho số kênh (không cộng dồn) để không vỡ tiếng
  // khi hai kênh gần giống nhau — trường hợp phổ biến nhất của bản ghi cuộc họp.
  const rest: Float32Array[] = []
  for (let c = 1; c < channels; c++) rest.push(buffer.getChannelData(c))
  for (let i = 0; i < length; i++) {
    let sum = first[i]
    for (const channel of rest) sum += channel[i]
    const s = Math.max(-1, Math.min(1, sum / channels))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out.buffer
}

export async function decodeAudioFile(file: File): Promise<DecodedAudio> {
  const bytes = await file.arrayBuffer()
  // OfflineAudioContext (không phải AudioContext): chỉ giải mã, không mở thiết bị ra loa.
  const ctx = new OfflineAudioContext(1, 1, TARGET_SAMPLE_RATE)
  let buffer: AudioBuffer
  try {
    buffer = await ctx.decodeAudioData(bytes)
  } catch {
    throw new AudioFileDecodeError(file.name)
  }
  if (buffer.length === 0) throw new AudioFileDecodeError(file.name)
  return {
    pcm: toMonoInt16(buffer),
    durationMs: Math.round((buffer.length / TARGET_SAMPLE_RATE) * 1000)
  }
}
