// Adapter: tệp audio HOẶC video trên đĩa → PCM signed 16-bit, mono, 16 kHz.
//
// Giải mã bằng Web Audio của Chromium: `decodeAudioData` demux luôn cả container
// video và chỉ lấy track âm thanh, nên "tách audio từ video" không cần ffmpeg hay bất
// kỳ công cụ ngoài nào — vẫn đúng nguyên tắc chạy hoàn toàn cục bộ của dự án.
//
// Đo trên Electron 39 (macOS arm64) bằng tệp dựng sẵn cho từng container:
//
//   đọc được : mp3, m4a, wav, flac, ogg, webm(vp8+opus), mp4/mov/m4v/3gp(h264+aac),
//              mkv (aac và opus)
//   KHÔNG    : avi, mpeg-ts, flv, wmv  → Chromium không có demuxer cho những cái này
//
// Nhóm không đọc được đều là định dạng cũ; Meet/Zoom/OBS đều xuất ra mp4/mkv/webm.
// Vì vậy không đóng gói ffmpeg.wasm (~30 MB) chỉ để cứu vài định dạng hiếm — thay vào
// đó báo lỗi nói rõ phải chuyển sang mp4/mkv.
//
// `decodeAudioData` resample sẵn về sampleRate của context, nên chỉ còn phải trộn các
// kênh về mono và đổi Float32 → Int16.

import { TARGET_SAMPLE_RATE } from './pcm16-stream'

export interface DecodedAudio {
  pcm: ArrayBuffer // PCM 16-bit little-endian, mono, 16 kHz
  durationMs: number
}

/** Vì sao không giải mã được — quyết định câu thông báo cho người dùng. */
export type DecodeFailure = 'unsupported-container' | 'no-audio-or-corrupt' | 'too-large'

export class MediaDecodeError extends Error {
  constructor(readonly reason: DecodeFailure) {
    super(reason)
  }
}

// Đuôi tệp video (để gắn nhãn VIDEO và chọn đúng câu lỗi).
const VIDEO_EXTENSIONS = /\.(mp4|mov|mkv|avi|m4v|flv|wmv|mpe?g|ts|3gp|webm)$/i

// Container Chromium không demux được — đo bằng thực nghiệm, không phải phỏng đoán.
const UNSUPPORTED_EXTENSIONS = /\.(avi|flv|wmv|mpe?g|ts|m2ts|vob|rm|rmvb)$/i

// Cả tệp phải nằm trong RAM để đưa vào decodeAudioData; 2 GB đã là một buổi họp rất
// dài quay ở chất lượng cao, quá mức đó thì báo sớm thay vì để trình duyệt tự chết.
const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || VIDEO_EXTENSIONS.test(file.name)
}

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

/** Lấy phần tiếng của một tệp media (audio hoặc video) về đúng định dạng ASR cần. */
export async function decodeMediaAudio(file: File): Promise<DecodedAudio> {
  if (file.size > MAX_FILE_BYTES) throw new MediaDecodeError('too-large')

  const bytes = await file.arrayBuffer()
  // OfflineAudioContext (không phải AudioContext): chỉ giải mã, không mở thiết bị ra loa.
  const ctx = new OfflineAudioContext(1, 1, TARGET_SAMPLE_RATE)
  let buffer: AudioBuffer
  try {
    buffer = await ctx.decodeAudioData(bytes)
  } catch {
    // Chromium trả đúng một câu lỗi cho mọi trường hợp ("Unable to decode audio data"),
    // nên phân biệt bằng đuôi tệp: container nằm trong danh sách không hỗ trợ thì chắc
    // chắn là do container; còn lại thì thường là video không có tiếng, hoặc tệp hỏng.
    throw new MediaDecodeError(
      UNSUPPORTED_EXTENSIONS.test(file.name) ? 'unsupported-container' : 'no-audio-or-corrupt'
    )
  }
  if (buffer.length === 0) throw new MediaDecodeError('no-audio-or-corrupt')
  return {
    pcm: toMonoInt16(buffer),
    durationMs: Math.round((buffer.length / TARGET_SAMPLE_RATE) * 1000)
  }
}
