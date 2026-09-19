import { describe, expect, it } from 'vitest'
import {
  bubbleLines,
  formatElapsed,
  isTypingTarget,
  modeFromToggles,
  togglesFromMode
} from './meeting'

describe('hai công tắc ↔ ba chế độ', () => {
  it('ánh xạ đủ bốn tổ hợp', () => {
    expect(modeFromToggles(true, true)).toBe('two_way')
    expect(modeFromToggles(true, false)).toBe('listen')
    expect(modeFromToggles(false, true)).toBe('speak')
    expect(modeFromToggles(false, false)).toBeNull()
  })

  it('đi và về không mất gì', () => {
    for (const mode of ['listen', 'speak', 'two_way'] as const) {
      const { listen, me } = togglesFromMode(mode)
      expect(modeFromToggles(listen, me)).toBe(mode)
    }
  })
})

describe('bubbleLines — chữ to luôn là ngôn ngữ của mình', () => {
  it('câu của cuộc họp: bản dịch to, câu gốc nhỏ', () => {
    expect(bubbleLines('remote', 'We should ship Friday.', 'Nên phát hành thứ Sáu.')).toEqual({
      primary: 'Nên phát hành thứ Sáu.',
      secondary: 'We should ship Friday.',
      pending: false
    })
  })

  it('câu của cuộc họp chưa có bản dịch: tạm in câu gốc, đánh dấu đang chờ', () => {
    expect(bubbleLines('remote', 'We should ship Friday.', '')).toEqual({
      primary: 'We should ship Friday.',
      secondary: '',
      pending: true
    })
  })

  it('câu của mình: câu gốc to, bản dịch nhỏ', () => {
    expect(bubbleLines('me', 'Được, mai tôi gửi.', "OK, I'll send it tomorrow.")).toEqual({
      primary: 'Được, mai tôi gửi.',
      secondary: "OK, I'll send it tomorrow.",
      pending: false
    })
  })
})

describe('formatElapsed', () => {
  it('phút:giây, qua một giờ thì thêm giờ', () => {
    expect(formatElapsed(0)).toBe('00:00')
    expect(formatElapsed(247_000)).toBe('04:07')
    expect(formatElapsed(3_753_000)).toBe('1:02:33')
  })
})

describe('isTypingTarget', () => {
  it('đang gõ vào ô nhập thì Space là dấu cách, không phải giữ để nói', () => {
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
    expect(isTypingTarget(document.createElement('input'))).toBe(true)
    expect(isTypingTarget(document.createElement('button'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
