// Chụp sáu ảnh màn hình cho Chương 3 của đồ án, từ app Electron THẬT.
//
// Không nằm trong `make e2e`: tên tệp là `*.shots.ts` nên `testMatch: '**/*.e2e.ts'`
// của playwright.config bỏ qua nó. Chạy bằng `make figures-app`. Tách ra vì bài này
// mất vài phút (phải nạp đủ bốn khâu) và vì nó GHI vào docs/, hai thứ không nên xảy ra
// mỗi lần chạy test.
//
// Dùng thư mục model thật và tệp lịch sử thật, chỉ đọc chứ không xoá gì: ảnh trong báo
// cáo phải là trạng thái thật của ứng dụng — model có tên và dung lượng thật, màn Lịch
// sử có phiên thật — chứ không phải một app trống vừa cài xong.
//
// TRÊN WINDOWS phải chạy `make setup-vulkan` trước và đặt UV_NO_SYNC=1 (Makefile đã
// đặt sẵn). Fixtures khởi động service bằng `uv run`, mà lệnh đó đồng bộ venv về wheel
// pywhispercpp của PyPI — tức bản CPU. Thiếu bước này thì ảnh màn Quản lý Model ghi
// thiết bị ASR là "CPU", mâu thuẫn với bảng số ở Chương 4.

import { mkdirSync } from 'fs'
import { homedir } from 'os'
import { join, resolve } from 'path'
import { expect, test } from '@playwright/test'
import { launch, type Harness } from './fixtures'

// Khổ 16:10 vừa với bề rộng vùng chữ của khổ A4 mà chữ trong ảnh vẫn đọc được khi in.
const WIDTH = 1440
const HEIGHT = 900
const OUT = resolve(__dirname, '../../../docs/gvhd/khoa-luan-hinh')
const MODELS_DIR = process.env.LLVT_REAL_MODELS_DIR ?? 'D:/Project/models'
const DB_PATH = process.env.LLVT_REAL_DB_PATH ?? join(homedir(), '.llvt', 'history.db')

let h: Harness

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true })
  h = await launch({ modelsDir: MODELS_DIR, dbPath: DB_PATH })

  // Cửa sổ Electron không đổi kích thước qua Page.setViewportSize (đó là API của
  // trình duyệt); phải đặt bounds của BrowserWindow ở tiến trình main.
  await h.app.evaluate(async ({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.setBounds({ x: 40, y: 40, ...size })
  }, { width: WIDTH, height: HEIGHT })
  await h.win.waitForTimeout(500)
})

test.afterAll(async () => {
  await h?.stop()
})

async function shot(name: string): Promise<void> {
  // Chờ hết hoạt ảnh chuyển màn rồi mới chụp, không thì dính khung đang mờ dần.
  await h.win.waitForTimeout(900)
  await h.win.screenshot({ path: join(OUT, name) })
}

async function open(label: string): Promise<void> {
  await h.win.getByRole('button', { name: label, exact: true }).click()
}

test('nạp đủ bốn khâu rồi chụp sáu màn hình', async () => {
  const { win } = h

  await open('Quản lý Model')
  await win.getByRole('button', { name: /Khởi động model/ }).click()
  // Nạp thật cả bốn khâu: whisper.cpp phải biên dịch shader Vulkan ở lần đầu trên máy.
  await expect(win.locator('aside').getByText('Sẵn sàng Offline')).toBeVisible({
    timeout: 240_000
  })
  await shot('h3-13-mo-hinh.png')

  await open('Thiết bị âm thanh')
  await shot('h3-11-thiet-lap.png')

  await open('Phiên dịch')
  await shot('h3-12-phien-dich.png')

  await open('Chẩn đoán')
  // Màn này hỏi /api/resources theo chu kỳ; chờ một nhịp để ô CPU/RAM có số thật.
  await win.waitForTimeout(2500)
  await shot('h3-14-chan-doan.png')

  await open('Đánh giá')
  await shot('h3-15-danh-gia.png')

  await open('Lịch sử')
  await shot('h3-16-lich-su.png')
})
