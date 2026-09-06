// Vitest cho renderer.
//
// Không dùng chung `electron.vite.config.ts`: file đó mô tả BA môi trường build
// (main/preload/renderer) của electron-vite, còn test chỉ chạy mã renderer dưới Node.
// Gộp vào một file sẽ phải phân nhánh theo lệnh đang chạy — tách ra thì mỗi file nói
// đúng một việc.
//
// `environment: 'jsdom'` là bắt buộc chứ không phải cho tiện: `application/config.ts`
// đọc `window.llvt` NGAY LÚC nạp module, nên bất cứ test nào chạm tới lớp adapter mà
// không có `window` sẽ chết ở khâu import.

import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@renderer': resolve('src/renderer/src') }
  },
  test: {
    environment: 'jsdom',
    include: ['src/renderer/src/**/*.test.{ts,tsx}'],
    globals: true,
    restoreMocks: true
  }
})
