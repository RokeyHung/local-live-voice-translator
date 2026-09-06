// Một test render thật, để phần component không phải dựng lại hạ tầng từ đầu khi cần.
//
// Chọn `Notice` và `DisabledButton` vì cả hai đều mang MỘT lời hứa với người dùng:
// Notice là chỗ duy nhất báo "service không chạy" sau khi bỏ dải trạng thái ở màn
// Quản lý model, còn DisabledButton phải luôn kèm lý do — nút mờ không giải thích gì
// là thứ tệ nhất có thể để lại trong giao diện.

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DisabledButton, Notice } from './primitives'

describe('Notice', () => {
  it('hiện cả tiêu đề lẫn phần giải thích', () => {
    render(
      <Notice tone="warn" icon="warning" title="Không kết nối được" body="Kiểm tra service." />
    )

    expect(screen.getByText('Không kết nối được')).toBeTruthy()
    expect(screen.getByText('Kiểm tra service.')).toBeTruthy()
  })

  it('không có phần giải thích thì không render khối rỗng', () => {
    const { container } = render(<Notice tone="error" icon="warning" title="Lỗi" />)

    expect(container.textContent).toBe('Lỗi')
  })
})

describe('DisabledButton', () => {
  it('luôn không bấm được và luôn kèm lý do', () => {
    render(
      <DisabledButton label="Tải" hint="Model này chỉ chạy trên Apple Silicon" icon="download" />
    )

    const button = screen.getByRole('button', { name: /Tải/ })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.getAttribute('title')).toBe('Model này chỉ chạy trên Apple Silicon')
  })
})
