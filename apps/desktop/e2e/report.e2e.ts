// Bài chạy lấy số liệu cho báo cáo GVHD.
//
// Khác `models.e2e.ts` ở hai chỗ: nó chạy trên THƯ MỤC MODEL THẬT (không tạo thư mục
// tạm) và dùng đúng preset "Tự chọn" mà người dùng đã đặt — MLX Whisper large-v3-turbo
// fp16 + NLLB-200-600M. Vì thế nó không được gọi bất kỳ lệnh xoá nào.
//
// Mọi con số đo được ghi ra `e2e-artifacts/report.json` để chép thẳng vào báo cáo,
// kèm ảnh chụp từng bước làm bằng chứng.
//
// Chạy: LLVT_REAL_MODELS_DIR=/đường/dẫn npx playwright test report.e2e.ts

import { mkdirSync, writeFileSync } from 'fs'
import { expect, test } from '@playwright/test'
import { launch, type Harness } from './fixtures'

const MODELS_DIR = process.env.LLVT_REAL_MODELS_DIR ?? '/Volumes/havi/project/models'
const OUT = 'e2e-artifacts'

let h: Harness
const report: Record<string, unknown> = { chayLuc: new Date().toISOString(), modelsDir: MODELS_DIR }

function shot(name: string): Promise<Buffer> {
  return h.win.screenshot({ path: `${OUT}/bao-cao-${name}.png`, fullPage: true })
}

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true })
  h = await launch({ modelsDir: MODELS_DIR })
})

test.afterAll(async () => {
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2) + '\n')
  await h?.stop()
})

test('1. cấu hình máy và phiên bản', async () => {
  const { win } = h

  await win.getByRole('button', { name: 'Chẩn đoán' }).click()
  await win.waitForTimeout(2500) // để query tài nguyên kịp có mẫu đầu tiên
  await shot('01-chan-doan')

  const health = await win.evaluate(async () =>
    (await fetch('http://127.0.0.1:8756/health')).json()
  )
  const compute = await win.evaluate(() => ({
    cores: navigator.hardwareConcurrency,
    ram: (navigator as unknown as { deviceMemory?: number }).deviceMemory
  }))
  report.may = { ...compute, nenTang: health.platform, phienBanService: health.version }
  expect(health.status).toBe('ok')
})

test('2. preset Tự chọn trỏ đúng runtime và model đã chọn', async () => {
  const { win } = h

  await win.getByRole('button', { name: 'Quản lý Model' }).click()
  await win.getByRole('button', { name: /Tự chọn/ }).click()
  await win.waitForTimeout(1000)

  const cfg = await win.evaluate(async () =>
    (await fetch('http://127.0.0.1:8756/api/config')).json()
  )
  expect(cfg.preset).toBe('custom')
  // Chọn preset KHÔNG được nạp model — đây cũng là một điểm để báo cáo.
  expect(cfg.stages).toEqual([])

  report.preset = {
    ten: cfg.preset,
    asrRuntime: cfg.custom.asrAdapter,
    asrModel: cfg.custom.asrModel,
    mtModel: cfg.custom.mtModel
  }
  expect(cfg.custom.asrAdapter).toBe('mlx_whisper')

  const onDisk = await win.evaluate(async () =>
    (await fetch('http://127.0.0.1:8756/api/models')).json()
  )
  report.modelTrenDia = onDisk.map((m: Record<string, unknown>) => ({
    ten: m.name,
    khau: m.stage,
    gb: Number(((m.sizeBytes as number) / 1e9).toFixed(2)),
    daTaiDu: m.complete
  }))
  expect(onDisk.every((m: { complete: boolean }) => m.complete)).toBe(true)

  await shot('02-preset-tu-chon')
})

test('3. nạp model thật, đo thời gian nạp', async () => {
  const { win } = h
  test.setTimeout(900_000)

  const t0 = Date.now()
  await win.getByRole('button', { name: /Khởi động model/ }).click()
  // Nạp xong thì nút đổi thành "Nạp lại" + "Giải phóng".
  await expect(win.getByRole('button', { name: /Giải phóng/ })).toBeVisible({ timeout: 600_000 })
  report.thoiGianNapGiay = Number(((Date.now() - t0) / 1000).toFixed(1))

  const cfg = await win.evaluate(async () =>
    (await fetch('http://127.0.0.1:8756/api/config')).json()
  )
  report.khau = cfg.stages.map((s: Record<string, unknown>) => ({
    khau: s.stage,
    adapter: s.adapter,
    model: s.model,
    thietBi: s.accel,
    daNap: s.loaded
  }))
  expect(cfg.stages).toHaveLength(4)
  expect(cfg.stages.every((s: { loaded: boolean }) => s.loaded)).toBe(true)

  await shot('03-da-nap-model')
})

test('4. đo độ trễ từng khâu, cả hai chiều vi↔en', async () => {
  const { win } = h
  test.setTimeout(600_000)

  // Đo qua đúng API mà nút "Chạy test" ở màn Chẩn đoán gọi, cho cả hai chiều —
  // Whisper và NLLB không đối xứng nên một chiều không nói thay được chiều kia.
  const doChieu = (source: string, target: string): Promise<Record<string, number>> =>
    win.evaluate(
      async ([s, t]) =>
        (
          await fetch('http://127.0.0.1:8756/api/benchmark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: s, target: t })
          })
        ).json(),
      [source, target]
    )

  const doTre: Record<string, unknown> = {}
  for (const [s, t] of [
    ['vi', 'en'],
    ['en', 'vi'],
    ['vi', 'ja'],
    ['ja', 'vi'],
    ['vi', 'zh'],
    ['zh', 'vi']
  ]) {
    const r = await doChieu(s, t)
    doTre[`${s}→${t}`] = {
      vadMs: Math.round(r.vadMs),
      asrMs: Math.round(r.asrMs),
      mtMs: Math.round(r.mtMs),
      ttsMs: Math.round(r.ttsMs),
      tongMs: Math.round(r.totalMs)
    }
    expect(r.totalMs).toBeGreaterThan(0)
  }
  report.doTreMs = doTre

  await win.getByRole('button', { name: 'Chẩn đoán' }).click()
  await win.getByRole('button', { name: /Chạy test/ }).click()
  await expect(win.getByRole('button', { name: /Chạy test/ })).toBeEnabled({ timeout: 300_000 })
  await shot('04-do-tre')
})

test('5. đánh giá chất lượng: WER/CER + chrF trên đủ sáu chiều', async () => {
  const { win } = h
  test.setTimeout(1_800_000)

  await win.getByRole('button', { name: 'Đánh giá' }).click()
  await shot('05a-man-danh-gia')

  const corpus = await win.evaluate(async () =>
    (await fetch('http://127.0.0.1:8756/api/evaluate/corpus')).json()
  )
  report.boMau = { soCau: corpus.length }

  // Chạy qua ĐÚNG nút người dùng bấm, không gọi API tắt: có vậy ảnh chụp mới là bằng
  // chứng rằng màn hình chạy được, chứ không chỉ chứng minh API chạy được.
  await win.getByRole('checkbox', { name: /Chạy thử 3 câu/ }).uncheck()
  const phanHoi = win.waitForResponse(
    (r) => r.url().endsWith('/api/evaluate') && r.request().method() === 'POST',
    { timeout: 1_500_000 }
  )
  await win.getByRole('button', { name: /Chạy đánh giá/ }).click()
  const ketQua = await (await phanHoi).json()

  report.danhGia = {
    soCauChamDuoc: ketQua.cases.length,
    // Một con số lỗi duy nhất: vi/en chấm bằng WER (theo từ), zh/ja bằng CER (theo
    // ký tự) — tiếng Trung/Nhật không tách từ bằng dấu cách nên WER vô nghĩa.
    tyLeLoi: Number(ketQua.errorRate.toFixed(4)),
    chrf: Number(ketQua.chrf.toFixed(4)),
    asrP50Ms: ketQua.asrP50Ms,
    asrP90Ms: ketQua.asrP90Ms,
    mtP50Ms: ketQua.mtP50Ms,
    mtP90Ms: ketQua.mtP90Ms,
    tongP90Ms: ketQua.totalP90Ms,
    rtfP90: Number(ketQua.rtfP90.toFixed(3)),
    // Cờ này phải đi kèm MỌI con số ở trên khi đưa vào báo cáo.
    coGiongTongHop: ketQua.hasSyntheticAudio
  }

  // Tách theo chiều dịch — số gộp giấu mất chiều nào đang kém.
  const theoChieu: Record<
    string,
    { soCau: number; thangDo: string; tyLeLoi: number; chrf: number }
  > = {}
  for (const c of ketQua.cases) {
    const key = `${c.language}→${c.target}`
    const g = (theoChieu[key] ??= { soCau: 0, thangDo: c.metric, tyLeLoi: 0, chrf: 0 })
    g.soCau += 1
    g.tyLeLoi += c.errorRate
    g.chrf += c.chrf
  }
  for (const g of Object.values(theoChieu)) {
    g.tyLeLoi = Number((g.tyLeLoi / g.soCau).toFixed(4))
    g.chrf = Number((g.chrf / g.soCau).toFixed(4))
  }
  report.danhGiaTheoChieu = theoChieu
  report.nguonAmThanh = [
    ...new Set(ketQua.cases.map((c: { audioSource: string }) => c.audioSource))
  ]

  expect(ketQua.cases.length).toBe(corpus.length)
  await shot('05b-ket-qua-danh-gia')
})

test('6. không lỗi nào lọt vào console suốt cả bài chạy', async () => {
  const loi = h.logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'))
  report.loiConsole = loi
  expect(loi, `console của renderer:\n${h.logs.join('\n')}`).toEqual([])
})
