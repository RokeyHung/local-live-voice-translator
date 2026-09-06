// Hai bảng ngôn ngữ phải song song nhau.
//
// `Dict` là interface nên TypeScript đã bắt được khoá THIẾU. Cái nó không bắt được là
// khoá bỏ trống, khoá còn nguyên tiếng Việt trong bảng tiếng Anh, hay tham số `{x}`
// lệch giữa hai bản — những thứ chỉ lộ ra khi đổi ngôn ngữ giao diện lúc chạy.

import { describe, expect, it } from 'vitest'
import { dict, format } from './i18n'

const vi = dict('vi')
const en = dict('en')

describe('bảng ngôn ngữ', () => {
  it('hai bản có đúng cùng bộ khoá', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(vi).sort())
  })

  it('không khoá nào bỏ trống', () => {
    const empty = (d: Record<string, string>): string[] =>
      Object.entries(d)
        .filter(([, v]) => typeof v === 'string' && v.trim() === '')
        .map(([k]) => k)

    expect(empty(vi as unknown as Record<string, string>)).toEqual([])
    expect(empty(en as unknown as Record<string, string>)).toEqual([])
  })

  it('tham số {…} khớp nhau giữa hai bản', () => {
    const params = (s: string): string[] => (s.match(/\{(\w+)\}/g) ?? []).sort()
    const lệch: string[] = []
    for (const key of Object.keys(vi) as (keyof typeof vi)[]) {
      const a = vi[key]
      const b = en[key]
      if (typeof a !== 'string' || typeof b !== 'string') continue
      if (JSON.stringify(params(a)) !== JSON.stringify(params(b))) lệch.push(String(key))
    }
    expect(lệch).toEqual([])
  })

  it('bản tiếng Anh không sót dấu tiếng Việt', () => {
    const conDau = Object.entries(en)
      .filter(([, v]) => typeof v === 'string' && /[ăâđêôơưàáảãạằắẳẵặèéẻẽẹìíỉĩị]/i.test(v))
      .map(([k]) => k)

    expect(conDau).toEqual([])
  })
})

describe('format', () => {
  it('thay đúng tham số', () => {
    expect(format('Đã tải {name} ({size})', { name: 'x', size: '2 GB' })).toBe('Đã tải x (2 GB)')
  })

  it('tham số thiếu thì giữ nguyên chỗ trống thay vì in "undefined"', () => {
    expect(format('Xin chào {ai}', {})).not.toContain('undefined')
  })
})
