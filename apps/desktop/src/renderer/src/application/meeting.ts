// Luật thuần cho màn Phiên dịch — một bố cục duy nhất, dựng cho cuộc họp.
//
// Trước đây màn này có ba bố cục (Chia đôi / Dòng thời gian / Tập trung). Cuộc họp là
// hỏi–đáp nối tiếp nhau, chia hai cột làm mất thứ tự ai trả lời câu nào, nên chỉ giữ
// dòng thời gian (như phụ đề của Zoom/Meet/Teams) và bỏ nút chọn bố cục.

import type { SessionMode, Side } from '../domain/enums'

/**
 * Hai công tắc thay cho ba thẻ chế độ: "Nghe cuộc họp" (âm thanh hệ thống) và "Dịch
 * giọng tôi" (micro). Tắt cả hai thì không có gì để dịch — trả null để giao diện
 * không cho tắt cái cuối cùng.
 */
export function modeFromToggles(listen: boolean, me: boolean): SessionMode | null {
  if (listen && me) return 'two_way'
  if (listen) return 'listen'
  if (me) return 'speak'
  return null
}

export function togglesFromMode(mode: SessionMode): { listen: boolean; me: boolean } {
  return { listen: mode !== 'speak', me: mode !== 'listen' }
}

/**
 * Dòng chữ nào in to trong một câu. Quy tắc: chữ to luôn là NGÔN NGỮ CỦA MÌNH.
 * Câu của cuộc họp → bản dịch to, câu gốc nhỏ để đối chiếu. Câu của mình → câu gốc
 * (mình vừa nói) to, bản dịch nhỏ bên dưới. Bản dịch chưa về thì tạm in câu gốc ở
 * chỗ chữ to, đánh dấu `pending` để giao diện làm mờ.
 */
export function bubbleLines(
  side: Side,
  sourceText: string,
  translated: string
): { primary: string; secondary: string; pending: boolean } {
  if (side === 'me') return { primary: sourceText, secondary: translated, pending: false }
  if (!translated) return { primary: sourceText, secondary: '', pending: true }
  return { primary: translated, secondary: sourceText, pending: false }
}

/** "04:07" / "1:02:33" — đồng hồ phiên trên thanh trên cùng. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * Phím Space có được hiểu là "giữ để nói" không. Không, khi đang gõ vào ô nhập (ô
 * sửa bản dịch của khung Duyệt, ô tìm kiếm…) — nếu không, gõ dấu cách là bật micro.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}
