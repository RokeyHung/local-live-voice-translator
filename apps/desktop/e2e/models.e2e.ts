// Màn Quản lý model, chạy trên app đã đóng gói + AI service thật.
//
// Kịch bản đúng như người dùng làm lần đầu: mở app, sang Quản lý model, thấy chưa có
// model nào, gõ tên một model rồi bấm Tải về, và thấy nó xuất hiện trong "Model đã
// cài" với dung lượng thật. Model chọn là `ggml-tiny-q5_1.bin` (32 MB) — đủ nhỏ để
// tải thật trong một test mà vẫn là một lượt tải qua mạng đúng nghĩa.

import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { expect, test } from '@playwright/test'
import { launch, type Harness } from './fixtures'

let h: Harness

test.beforeAll(async () => {
  h = await launch()
})

test.afterAll(async () => {
  await h?.stop()
})

test('app khởi động và bắt được AI service', async () => {
  const { win } = h

  await expect(win).toHaveTitle('Local Live Voice Translator')
  // Dải trạng thái ở chân thanh bên: "chưa nạp model" nghĩa là service ĐANG sống mà
  // chưa có gì trong RAM — đúng trạng thái sau khi khởi động. Khoanh vùng trong
  // <aside> vì App giữ MỌI màn ở lại DOM (chỉ ẩn đi), nên tìm chuỗi trên cả trang sẽ
  // vớ phải chữ của một màn đang ẩn.
  const sidebar = win.locator('aside')
  await expect(sidebar.getByText('Chưa nạp model')).toBeVisible({ timeout: 20_000 })
  await expect(sidebar.getByText('Chưa kết nối AI service')).toHaveCount(0)
})

test('màn Quản lý model: chưa nạp gì, và chỉ nút Khởi động mới nạp', async () => {
  const { win } = h

  await win.getByRole('button', { name: 'Quản lý Model' }).click()

  await expect(win.getByRole('button', { name: /Khởi động model/ })).toBeVisible()
  await expect(win.getByText('Chưa có model nào trên đĩa')).toBeVisible()

  // Bấm một preset KHÔNG được nạp model: `stages` phải vẫn rỗng sau đó.
  await win.getByRole('button', { name: /Quality/ }).click()
  await win.waitForTimeout(1500)

  const cfg = await win.evaluate(async () =>
    (await fetch('http://127.0.0.1:8756/api/config')).json()
  )
  expect(cfg.preset).toBe('quality')
  expect(cfg.stages).toEqual([])
  await expect(win.getByRole('button', { name: /Khởi động model/ })).toBeVisible()
})

test('tải thật một model rồi thấy nó trong "Model đã cài"', async () => {
  const { win, modelsDir } = h

  await win.getByPlaceholder(/Lọc danh mục/).fill('ggml-tiny-q5_1.bin')
  await win
    .getByRole('button', { name: /Tải về/ })
    .first()
    .click()

  // Chờ nó hiện ở cột trái — cột này đọc từ `GET /api/models`, tức là đã nằm trên đĩa.
  const installed = win.getByTitle(join(modelsDir, 'whisper-cpp', 'ggml-tiny-q5_1.bin'))
  await expect(installed).toBeVisible({ timeout: 120_000 })
  // Khoanh trong đúng dòng model: tổng dung lượng ở đầu cột cũng đang là 30.7 MB, và
  // một phép kiểm khớp cả hai thì không chứng minh được dòng model hiện đúng số nào.
  await expect(installed.locator('xpath=..')).toContainText('30.7 MB')

  // Và kiểm tra ngoài giao diện: file có thật, không sót thư mục tải dở.
  expect(existsSync(join(modelsDir, 'whisper-cpp', 'ggml-tiny-q5_1.bin'))).toBe(true)
  expect(readdirSync(join(modelsDir, 'whisper-cpp'))).toEqual(['ggml-tiny-q5_1.bin'])

  await win.screenshot({ path: 'e2e-artifacts/da-tai-model.png', fullPage: true })
})

test('xoá model vừa tải, đĩa sạch trở lại', async () => {
  const { win, modelsDir } = h

  win.on('dialog', (d) => d.accept())
  await win.getByRole('button', { name: /Xóa tất cả/ }).click()

  await expect(win.getByText('Chưa có model nào trên đĩa')).toBeVisible({ timeout: 30_000 })
  expect(existsSync(join(modelsDir, 'whisper-cpp'))).toBe(false)
})

test('không có lỗi nào lọt vào console của renderer', async () => {
  const loi = h.logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'))
  expect(loi, `console của renderer:\n${h.logs.join('\n')}`).toEqual([])
})
