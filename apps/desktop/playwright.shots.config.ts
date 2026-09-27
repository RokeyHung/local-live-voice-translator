// Cấu hình riêng cho bài chụp ảnh màn hình (e2e/*.shots.ts).
//
// Vì sao không dùng chung playwright.config: cấu hình chính lọc `**/*.e2e.ts`, nên bài
// chụp ảnh không bị `make e2e` vớ phải — nó nạp model thật mất vài phút và ghi thẳng
// vào docs/. Playwright không có cờ dòng lệnh để đổi `testMatch`, nên cách tách sạch
// nhất là một tệp cấu hình thứ hai kế thừa tệp chính.

import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  testMatch: '**/*.shots.ts',
  // Nạp đủ bốn khâu trên máy chưa có cache shader Vulkan có thể mất vài phút.
  timeout: 600_000
})
