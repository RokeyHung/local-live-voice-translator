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

/** Khởi động service với một thư mục model RIÊNG, để test không đụng model thật. */
export function startService(): { proc: ChildProcess; modelsDir: string } {
  const modelsDir = mkdtempSync(join(tmpdir(), 'llvt-e2e-models-'))
  const proc = spawn('uv', ['run', 'llvt-ai-service'], {
    cwd: AI_DIR,
    env: {
      ...process.env,
      LLVT_MODELS_DIR: modelsDir,
      LLVT_DB_PATH: join(modelsDir, 'history.db')
    },
    stdio: 'ignore'
  })
  return { proc, modelsDir }
}

export async function launch(): Promise<Harness> {
  const { proc, modelsDir } = startService()
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
      rmSync(modelsDir, { recursive: true, force: true })
    }
  }
}
