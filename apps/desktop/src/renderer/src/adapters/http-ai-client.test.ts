// Lớp gọi REST của renderer, với `fetch` giả.
//
// Thứ đáng test ở đây không phải "có gọi đúng URL không" mà là: LỖI CỦA SERVICE CÓ
// ĐẾN ĐƯỢC NGƯỜI DÙNG KHÔNG. Màn Quản lý model hiện thẳng `error.message`; nếu lớp
// này nuốt mất phần `detail` thì người dùng chỉ thấy "HTTP 400" và không biết phải
// sửa gì — trong khi service đã nói rõ bằng tiếng Việt.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpAiClient } from './http-ai-client'

const client = new HttpAiClient()

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function lastCall(): { url: string; init: RequestInit } {
  const mock = vi.mocked(globalThis.fetch)
  const [url, init] = mock.mock.calls.at(-1) as [string, RequestInit]
  return { url: String(url), init }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('downloadModel', () => {
  it('gửi name + kind + force xuống service', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respond(200, { name: 'x', stage: 'ASR', path: '/m/x' })
    )

    await client.downloadModel('mlx-community/whisper-tiny-asr-4bit', 'mlx', true)

    const { url, init } = lastCall()
    expect(url).toContain('/api/models/download')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'mlx-community/whisper-tiny-asr-4bit',
      kind: 'mlx',
      force: true
    })
  })

  it('mặc định KHÔNG force — bấm Tải không được xoá bản đang có', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respond(200, { name: 'x', stage: 'ASR', path: '/m/x' })
    )

    await client.downloadModel('ggml-tiny-q5_1.bin')

    expect(JSON.parse(String(lastCall().init.body))).toMatchObject({ force: false })
  })

  it('lỗi của service đến được giao diện nguyên văn', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respond(404, { detail: 'Không có repo go-nham/x trên HuggingFace.' })
    )

    await expect(client.downloadModel('go-nham/x', 'mlx')).rejects.toThrow(
      'Không có repo go-nham/x trên HuggingFace.'
    )
  })

  it('service trả lỗi không phải JSON thì vẫn có thông báo đọc được', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response('<html>502</html>', { status: 502 }))

    await expect(client.downloadModel('ggml-tiny-q5_1.bin')).rejects.toThrow(/502/)
  })
})

describe('fetchInstalledModels', () => {
  it('đọc được cờ complete — thứ giao diện dựa vào để gắn nhãn "Tải chưa xong"', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respond(200, [
        { name: 'ggml-tiny-q5_1', stage: 'ASR', path: '/m/a', sizeBytes: 32, complete: true },
        { name: 'facebook/nllb-200-1.3B', stage: 'MT', path: '/m/b', sizeBytes: 9, complete: false }
      ])
    )

    const models = await client.fetchInstalledModels()

    expect(models.map((m) => m.complete)).toEqual([true, false])
  })
})

describe('updatePreset', () => {
  it('gửi preset và trả về cấu hình service phản hồi', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respond(200, { preset: 'fast', availablePresets: ['fast'], stages: [] })
    )

    const cfg = await client.updatePreset('fast')

    expect(lastCall().init.method).toBe('PUT')
    expect(cfg.stages).toEqual([])
  })
})

// Ghép lúc chạy thay vì viết thẳng một chuỗi: hook Gitleaks quét theo HÌNH DẠNG chứ
// không biết cái nào là token thật, và một chuỗi giả trông y như token trong repo là
// đúng thứ khiến người ta quen tay thêm ngoại lệ cho máy quét.
const FAKE_TOKEN = ['hf', 'khong', 'phai', 'token', 'that'].join('_')

describe('setHfToken', () => {
  it('token đi LÊN service nhưng không bao giờ được lưu lại phía renderer', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respond(200, { preset: 'fast', availablePresets: ['fast'], stages: [], hfTokenSet: true })
    )

    const cfg = await client.setHfToken('fast', FAKE_TOKEN)

    expect(JSON.parse(String(lastCall().init.body))).toMatchObject({ hfToken: FAKE_TOKEN })
    expect(JSON.stringify(cfg)).not.toContain(FAKE_TOKEN)
    expect(localStorage.getItem('llvt.prefs') ?? '').not.toContain(FAKE_TOKEN)
  })
})
