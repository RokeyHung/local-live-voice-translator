// Thanh tiêu đề tự vẽ chỉ có nghĩa khi hệ điều hành đã giấu thanh gốc (macOS,
// titleBarStyle: 'hiddenInset'). Windows giữ thanh gốc, nên vẽ thêm là tên app
// hiện hai lần.
//
// PLATFORM là hằng số đọc từ window.llvt lúc nạp module, nên mỗi test mock
// config rồi nạp lại TitleBar.

import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

async function renderOn(platform: string): Promise<HTMLElement> {
  vi.resetModules()
  vi.doMock('../../application/config', () => ({ PLATFORM: platform }))
  const { TitleBar } = await import('./TitleBar')
  return render(<TitleBar />).container
}

describe('TitleBar', () => {
  afterEach(() => {
    vi.doUnmock('../../application/config')
  })

  it('không vẽ trên Windows — thanh tiêu đề gốc đã hiện tên app', async () => {
    const container = await renderOn('win32')

    expect(container.textContent).toBe('')
  })

  it('vẫn vẽ trên macOS, nơi thanh gốc bị giấu', async () => {
    const container = await renderOn('darwin')

    expect(container.textContent).toBe('Local Live Voice Translator')
  })
})
