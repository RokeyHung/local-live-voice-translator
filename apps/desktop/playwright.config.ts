// E2E trên app Electron đã build (xem `e2e/fixtures.ts` để biết vì sao có lớp này).
//
// `workers: 1` là bắt buộc chứ không phải để cho chắc: AI service bind cố định cổng
// 8756, chạy song song hai worker là hai service tranh nhau một cổng.

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // Lượt tải model thật có thể mất vài phút trên mạng chậm.
  timeout: 300_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: 'e2e-report', open: 'never' }]],
  outputDir: 'e2e-artifacts',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure' }
})
