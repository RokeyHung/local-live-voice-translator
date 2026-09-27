// Giàn E2E: AI service Python THẬT + app Electron THẬT.
//
// Khác hẳn test ở `src/**/*.test.tsx` — chỗ đó giả `fetch` để chạy nhanh và ổn định.
// Ở đây không giả gì cả: service thật tải model thật về đĩa, app thật vẽ ra cửa sổ
// thật. Đây là chỗ duy nhất chứng minh được ba mảnh (Electron main, renderer,
// service) ráp lại thì chạy — thứ mà cả pytest lẫn vitest đều không nói được.

import { spawn, type ChildProcess } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

export const AI_BASE = 'http://127.0.0.1:8756'
const AI_DIR = resolve(__dirname, '../../ai-service')

export interface Harness {
  app: ElectronApplication
  win: Page
  modelsDir: string
  /** Mọi dòng console của renderer, theo thứ tự — đọc được app "nghĩ" gì lúc chạy. */
  logs: string[]
  stop: () => Promise<void>
}

async function waitForHealth(timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${AI_BASE}/health`)
      if (res.ok) return
    } catch {
      // service chưa lên — thử lại
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('AI service không lên trong thời gian chờ')
}

/** Khởi động service. Không truyền `modelsDir` thì dùng thư mục TẠM — test tải/xoá
 *  thoải mái mà không đụng model thật. Bài chạy cho báo cáo thì truyền thư mục thật
 *  vào, và tuyệt đối không được gọi lệnh xoá nào. */
export function startService(
  modelsDir?: string,
  dbPath?: string
): { proc: ChildProcess; modelsDir: string } {
  modelsDir = modelsDir ?? mkdtempSync(join(tmpdir(), 'llvt-e2e-models-'))
  const proc = spawn('uv', ['run', 'llvt-ai-service'], {
    cwd: AI_DIR,
    env: {
      ...process.env,
      LLVT_MODELS_DIR: modelsDir,
      LLVT_DB_PATH: dbPath ?? join(modelsDir, 'history.db')
    },
    stdio: 'ignore'
  })
  return { proc, modelsDir }
}

export interface LaunchOptions {
  /** Thư mục model. Bỏ trống = thư mục tạm, và `stop()` sẽ xoá nó đi. */
  modelsDir?: string
  /** Tệp SQLite lịch sử. Bỏ trống = nằm trong thư mục model, tức là rỗng với một
   *  thư mục tạm. Bài chụp ảnh cho báo cáo trỏ vào lịch sử THẬT để màn Lịch sử có
   *  nội dung; test thì không bao giờ được ghi vào đó. */
  dbPath?: string
}

export async function launch(options: LaunchOptions = {}): Promise<Harness> {
  const { proc, modelsDir } = startService(options.modelsDir, options.dbPath)
  const temporary = options.modelsDir === undefined
  await waitForHealth()

  // Terminal của VS Code đặt ELECTRON_RUN_AS_NODE=1; để nguyên thì Electron chạy như
  // Node thuần, `electron.app` là undefined và tiến trình chết ngay lúc nạp module.
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (k !== 'ELECTRON_RUN_AS_NODE' && v !== undefined) env[k] = v
  }

  const app = await electron.launch({
    args: [resolve(__dirname, '../out/main/index.js')],
    env,
    timeout: 60_000
  })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')

  const logs: string[] = []
  win.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`))
  win.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`))

  return {
    app,
    win,
    modelsDir,
    logs,
    stop: async () => {
      await app.close().catch(() => undefined)
      proc.kill('SIGTERM')
      // CHỈ xoá thư mục do chính test tạo ra. Xoá thư mục model thật của người dùng
      // là mất hàng GB và vài chục phút tải lại.
      if (temporary) rmSync(modelsDir, { recursive: true, force: true })
    }
  }
}
