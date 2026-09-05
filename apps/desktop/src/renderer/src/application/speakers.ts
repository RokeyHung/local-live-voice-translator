// Đổi mã người nói của AI service thành chữ hiển thị theo ngôn ngữ giao diện.
//
// Service trả về MÃ (`speaker-1`, `speaker-2`…) chứ không trả câu chữ, vì lịch sử là
// dữ liệu lưu lâu dài: người dùng đổi ngôn ngữ giao diện thì bản ghi cũ phải đổi
// theo, không được đóng băng tiếng Việt trong SQLite. Chỗ dịch mã sang chữ là đây,
// dùng chung cho cả màn hình lẫn phần xuất .txt/.srt.

import { format, type Dict } from './i18n'

// Màu cho từng người nói, lặp lại khi có nhiều hơn 6 người. Cùng bảng màu với các
// khâu pipeline để giao diện không bị loạn tông.
const SPEAKER_COLORS = ['#22d3ee', '#f59e0b', '#4ade80', '#f472b6', '#a855f7', '#fb923c']

/** `speaker-2` → 2. Trả null nếu mã không đúng dạng (model lạ, dữ liệu cũ). */
export function speakerIndex(code: string | null | undefined): number | null {
  const match = /^speaker-(\d+)$/.exec(code ?? '')
  return match ? Number(match[1]) : null
}

/**
 * Chữ hiển thị cho một mã người nói. `null` khi không có nhãn — gọi bên nào cũng
 * phải tự quyết định lúc đó hiện gì, vì chỗ thì bỏ trống, chỗ thì ghi "không rõ".
 */
export function speakerLabel(code: string | null | undefined, L: Dict): string | null {
  if (!code) return null
  const index = speakerIndex(code)
  // Mã không đúng dạng thì hiện nguyên văn còn hơn nuốt mất thông tin.
  return index === null ? code : format(L.speakerN, { n: index })
}

export function speakerColor(code: string | null | undefined): string {
  const index = speakerIndex(code)
  return index === null ? 'var(--text4)' : SPEAKER_COLORS[(index - 1) % SPEAKER_COLORS.length]
}
