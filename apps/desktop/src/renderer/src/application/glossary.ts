// Áp glossary lên bản dịch trước khi hiển thị/ghi lịch sử.
//
// MT chạy cục bộ không nhận từ điển cưỡng bức, nên việc thay thế làm ở client:
// khớp nguyên từ, không phân biệt hoa thường, giữ nguyên phần còn lại của câu.

import type { GlossaryEntry } from '../domain/models'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function applyGlossary(text: string, glossary: GlossaryEntry[]): string {
  if (!text || glossary.length === 0) return text
  return glossary.reduce((out, entry) => {
    if (!entry.source || !entry.target) return out
    try {
      // \b không hoạt động với ký tự có dấu ở đầu/cuối → dùng ranh giới thủ công.
      const pattern = new RegExp(
        `(^|[^\\p{L}\\p{N}])(${escapeRegExp(entry.source)})(?![\\p{L}\\p{N}])`,
        'giu'
      )
      return out.replace(pattern, (_m, lead: string) => `${lead}${entry.target}`)
    } catch {
      return out
    }
  }, text)
}
