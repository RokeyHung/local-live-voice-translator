// Khởi động AI service Python đi kèm trong bản cài.
//
// Lúc phát triển thì không làm gì: `make dev` đã tự chạy service bằng uv, và
// spawn thêm một tiến trình nữa chỉ tổ tranh cổng. Trong bản đóng gói thì
// ngược lại — không có uv trên máy người dùng, nên main process phải tự chạy
// bộ Python nằm trong Resources (xem tools/bundle_service.sh).

import { spawn, type ChildProcess } from 'child_process'
import { createWriteStream, existsSync } from 'fs'
import { join } from 'path'
import { app, dialog } from 'electron'

const HEALTH_URL = 'http://127.0.0.1:8756/health'

// Bao lâu thì coi như service không lên được. Lần chạy đầu nặng nhất là import
// torch (~3–5 giây trên máy đã đo); 60 giây là thừa cho cả máy chậm, mà vẫn
// không treo mãi nếu bundle hỏng.
const STARTUP_TIMEOUT_MS = 60_000
const HEALTH_POLL_MS = 500

let child: ChildProcess | null = null
let stopping = false

/** Đường dẫn tới bộ thông dịch Python trong Resources của bản cài. */
function bundledPythonPath(): string {
  const root = join(process.resourcesPath, 'service')
  return process.platform === 'win32' ? join(root, 'python.exe') : join(root, 'bin', 'python3.12')
}

/** Service đã chạy sẵn chưa (người dùng tự chạy `make service`, hay còn sót tiến trình cũ). */
async function isServiceUp(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_URL, {
      signal: AbortSignal.timeout(1_000)
    })
    return response.ok
  } catch {
    return false
  }
}

async function waitUntilUp(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child?.exitCode != null) return false // tiến trình chết trước khi kịp lên
    if (await isServiceUp()) return true
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS))
  }
  return false
}

/**
 * Chạy AI service. Trả về khi service trả lời /health, hoặc khi đã hết giờ chờ.
 *
 * Không ném lỗi: app vẫn mở được cửa sổ để người dùng thấy thông báo và đọc log,
 * thay vì chết câm lúc khởi động.
 */
export async function startAiService(): Promise<void> {
  // Ngoài bản đóng gói thì mặc định không spawn; LLVT_SPAWN_SERVICE=1 để ép.
  const forced = process.env.LLVT_SPAWN_SERVICE
  const shouldSpawn = forced === '1' || (forced !== '0' && app.isPackaged)
  if (!shouldSpawn) return

  if (await isServiceUp()) {
    console.log('AI service đã chạy sẵn ở 127.0.0.1:8756 — không spawn thêm.')
    return
  }

  const python = bundledPythonPath()
  if (!existsSync(python)) {
    dialog.showErrorBox(
      'Thiếu AI service',
      `Bản cài không có bộ Python đi kèm.\n\nĐã tìm ở:\n${python}\n\n` +
        'Bản cài này hỏng — hãy cài lại từ file .dmg / .exe gốc.'
    )
    return
  }

  // Log của service đi vào userData: khi bản cài lỗi trên máy người khác, đây là
  // thứ duy nhất đọc được (không có terminal nào để xem stdout).
  const logPath = join(app.getPath('userData'), 'ai-service.log')
  const logStream = createWriteStream(logPath, { flags: 'a' })
  logStream.write(`\n=== ${new Date().toISOString()} khởi động ===\n`)

  const recent: string[] = []
  const remember = (chunk: Buffer): void => {
    const text = chunk.toString()
    logStream.write(text)
    recent.push(text)
    if (recent.length > 40) recent.shift()
  }

  child = spawn(python, ['-m', 'llvt_ai_service'], {
    // PYTHONHOME/PYTHONPATH thừa hưởng từ máy người dùng sẽ trỏ bộ thông dịch
    // bundle sang site-packages của một bản Python khác và làm hỏng import.
    env: { ...process.env, PYTHONHOME: undefined, PYTHONPATH: undefined, PYTHONUNBUFFERED: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  child.stdout?.on('data', remember)
  child.stderr?.on('data', remember)

  child.on('exit', (code, signal) => {
    logStream.write(`=== thoát code=${code} signal=${signal} ===\n`)
    const crashed = child
    child = null
    if (stopping || crashed?.exitCode === 0) return
    dialog.showErrorBox(
      'AI service dừng đột ngột',
      `Tiến trình dịch đã thoát (code ${code ?? signal}).\n\n` +
        `Log đầy đủ: ${logPath}\n\n${recent.join('').slice(-1_500)}`
    )
  })

  const up = await waitUntilUp(STARTUP_TIMEOUT_MS)
  if (!up && child) {
    // Chưa trả lời nhưng cũng chưa chết — cứ để chạy tiếp, màn hình Chẩn đoán
    // của app sẽ hiện trạng thái khi nó lên.
    console.warn(`AI service chưa trả lời /health sau ${STARTUP_TIMEOUT_MS}ms; xem ${logPath}`)
  }
}

/** Dừng service khi app thoát. Không có bước này thì uvicorn sống sót thành tiến trình mồ côi. */
export function stopAiService(): void {
  if (!child) return
  stopping = true
  const { pid } = child
  if (process.platform === 'win32' && pid) {
    // SIGTERM trên Windows không lan sang tiến trình con của uvicorn.
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    child.kill('SIGTERM')
  }
  child = null
}
