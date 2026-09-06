// Quy tắc thuần về TÊN model, tách khỏi giao diện.
//
// Ba runtime ASR dùng ba định dạng khác nhau, và cùng một model có tới ba cách viết
// tuỳ chỗ: người dùng gõ tay ở ô tìm kiếm, service trả về khi liệt kê đĩa, service
// trả về khi báo model đang nạp. Chỗ nào cũng phải quy về nhau được, và đó là lý do
// những hàm này là quy tắc chứ không phải tiện ích hiển thị — chúng thuộc `application/`.

import type { DownloadKind } from '../domain/models'

// Runtime chạy được một model tải tay. Nhãn nói rõ khâu + engine vì tên adapter trần
// (`mlx`, `nllb`) không đủ để người dùng biết mình đang chọn gì.
export const DOWNLOAD_KINDS: DownloadKind[] = [
  'whisper_cpp',
  'mlx',
  'faster_whisper',
  'nllb',
  'pyannote'
]

export const DOWNLOAD_KIND_LABEL: Record<DownloadKind, string> = {
  whisper_cpp: 'ASR · whisper.cpp (GGML)',
  mlx: 'ASR · MLX',
  faster_whisper: 'ASR · faster-whisper',
  nllb: 'MT · NLLB',
  pyannote: 'DIA · pyannote'
}

/** Chuỗi người dùng gõ có giống một model không: `tổ-chức/tên` hoặc `ggml-*.bin`. */
export function looksLikeModelPath(query: string): boolean {
  const q = query.trim()
  return /^[\w.-]+\/[\w.-]+$/.test(q) || /^ggml-[\w.-]+\.bin$/.test(q)
}

/** Đoán runtime từ chính đường dẫn — người dùng vẫn đổi được ở ô chọn. */
export function guessDownloadKind(query: string): DownloadKind {
  const q = query.trim().toLowerCase()
  if (q.startsWith('ggml-')) return 'whisper_cpp'
  if (q.startsWith('pyannote/')) return 'pyannote'
  if (q.includes('nllb')) return 'nllb'
  if (q.startsWith('mlx-community/') || q.includes('-mlx')) return 'mlx'
  if (q.includes('faster-whisper') || q.includes('ct2')) return 'faster_whisper'
  return 'mlx'
}

/** Runtime của một model ĐÃ nằm trên đĩa — suy từ thư mục service đặt nó vào. */
export function kindFromPath(path: string): DownloadKind | undefined {
  const p = path.replace(/\\/g, '/')
  if (p.includes('/whisper-cpp/')) return 'whisper_cpp'
  if (p.includes('/mlx-whisper/')) return 'mlx'
  if (p.includes('/faster-whisper/')) return 'faster_whisper'
  if (p.includes('/nllb/')) return 'nllb'
  if (p.includes('/pyannote/')) return 'pyannote'
  // sherpa-tts và kokoro-ja: service tự nhận ra từ tên, không cần nói runtime.
  return undefined
}

// Tên model trên đĩa và tên service báo về không giống nhau: đĩa là tên file/thư mục
// (`ggml-large-v3-turbo-q5_0`, `facebook/nllb-200-distilled-600M`), còn service trả tên
// đầy đủ kèm `.bin`, hoặc — với TTS — một danh sách voice ngăn bằng dấu phẩy. Chuẩn hoá
// rồi so chứa nhau; không khớp thì coi như CHƯA nạp — báo thiếu còn hơn báo nhầm một
// model không nằm trong bộ nhớ là đã nạp.
export function normalizeModelName(name: string): string {
  const last = name.split('/').pop() ?? name
  return last
    .replace(/^ggml-/, '')
    .replace(/\.bin$/, '')
    .toLowerCase()
}

/** Model `name` (tên trên đĩa) có nằm trong danh sách model đang nạp không? */
export function isModelLoaded(name: string, loadedModels: string[]): boolean {
  const needle = normalizeModelName(name)
  if (needle.length <= 2) return false
  return loadedModels.some((m) => normalizeModelName(m).includes(needle))
}
