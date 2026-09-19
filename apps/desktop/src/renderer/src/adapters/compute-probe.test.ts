import { describe, expect, it } from 'vitest'
import { classify } from './compute-probe'

describe('classify', () => {
  it('nhận đúng hãng từ tên GPU mà WebGL báo', () => {
    expect(classify('angle (nvidia, nvidia geforce rtx 4060 laptop gpu direct3d11)')).toBe('nvidia')
    expect(classify('angle (intel, intel(r) iris(r) xe graphics direct3d11)')).toBe('intel')
    expect(classify('apple m4')).toBe('apple')
  })

  it('không có tên GPU thì là cpu — không đoán từ thứ khác', () => {
    expect(classify('')).toBe('cpu')
  })
})
