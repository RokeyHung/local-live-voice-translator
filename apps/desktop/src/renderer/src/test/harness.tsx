// Bộ giàn cho test ở mức màn hình.
//
// Ý đồ: KHÔNG giả các hook. Màn hình gọi hook thật, hook gọi `HttpAiClient` thật,
// client gọi `fetch` — và chỉ `fetch` bị thay bằng một service giả. Giả ở tầng hook
// thì test chỉ còn chứng minh rằng bản giả khớp với chính nó; giả ở tầng `fetch` thì
// mọi thứ giữa giao diện và dây REST đều là mã thật, kể cả react-query.
//
// Nhờ vậy test bắt được đúng loại lỗi đã xảy ra thật trong dự án này: bấm một nút
// gọi nhầm endpoint, hoặc giao diện quên gửi một tham số.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { vi } from 'vitest'
import type { ConfigResponse, InstalledModel, LoadProgress } from '../domain/models'
import { useUiStore } from '../stores/ui-store'

export interface RecordedCall {
  method: string
  path: string
  query: URLSearchParams
  body: Record<string, unknown> | null
}

export interface FakeService {
  config: ConfigResponse
  models: InstalledModel[]
  progress: LoadProgress
  /** false = service không chạy; mọi request ném lỗi mạng như lúc thật. */
  up: boolean
  /** Chặn một route để dựng tình huống lỗi. Trả `null` = để service giả xử lý bình thường. */
  override: ((route: string, body: Record<string, unknown> | null) => Response | null) | null
  calls: RecordedCall[]
  /** Những lời gọi tới đúng một endpoint, theo thứ tự. */
  callsTo: (path: string) => RecordedCall[]
}

export const LOADED_STAGES: ConfigResponse['stages'] = [
  { stage: 'VAD', adapter: 'silero', model: 'silero-vad', accel: 'CPU', loaded: true },
  {
    stage: 'ASR',
    adapter: 'whisper_cpp',
    model: 'ggml-small-q5_1.bin',
    accel: 'Metal',
    loaded: true
  },
  {
    stage: 'MT',
    adapter: 'nllb',
    model: 'facebook/nllb-200-distilled-600M',
    accel: 'mps',
    loaded: true
  },
  { stage: 'TTS', adapter: 'sherpa_onnx', model: 'vi + en', accel: 'CPU', loaded: true }
]

function baseConfig(): ConfigResponse {
  return {
    preset: 'fast',
    availablePresets: ['fast', 'balanced', 'quality', 'custom'],
    stages: [], // service không nạp model lúc khởi động
    modelsDir: '/models',
    modelsDirEditable: true,
    historyDbPath: '/models/history.db',
    historyEnabled: true,
    diarizationEnabled: false,
    hfTokenSet: false,
    hfTokenSource: 'none',
    hfTokenHint: '',
    hfTokenEditable: true,
    custom: {
      asrAdapter: 'whisper_cpp',
      asrModel: 'ggml-small-q5_1.bin',
      mtModel: 'facebook/nllb-200-distilled-600M',
      asrAdapterChoices: ['whisper_cpp', 'mlx_whisper', 'faster_whisper'],
      asrModelChoices: {
        whisper_cpp: ['ggml-tiny-q5_1.bin', 'ggml-small-q5_1.bin'],
        mlx_whisper: ['mlx-community/whisper-tiny-asr-4bit'],
        faster_whisper: ['Systran/faster-whisper-small']
      },
      mtModelChoices: ['facebook/nllb-200-distilled-600M', 'facebook/nllb-200-1.3B']
    }
  }
}

function idleProgress(): LoadProgress {
  return {
    active: false,
    cancelling: false,
    currentStage: null,
    overallPercent: null,
    error: null,
    stages: []
  }
}

/** Dựng service giả và cắm nó vào `fetch`. Trả về state để test đọc/sửa. */
export function fakeService(patch: Partial<FakeService> = {}): FakeService {
  const svc: FakeService = {
    config: baseConfig(),
    models: [],
    progress: idleProgress(),
    up: true,
    override: null,
    calls: [],
    callsTo: (path) => svc.calls.filter((c) => c.path === path),
    ...patch
  }

  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input))
      const method = (init?.method ?? 'GET').toUpperCase()
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
      svc.calls.push({ method, path: url.pathname, query: url.searchParams, body })

      // Service chết: `fetch` ném chứ không trả mã lỗi — đúng như lúc chạy thật.
      if (!svc.up) throw new TypeError('Failed to fetch')

      const route = `${method} ${url.pathname}`
      const forced = svc.override?.(route, body)
      if (forced) return forced

      switch (route) {
        case 'GET /health':
          return json({ status: 'ok', version: '0.1.0', offlineReady: true, platform: 'test' })
        case 'GET /api/config':
          return json(svc.config)
        case 'PUT /api/config': {
          // Đổi preset chỉ GHI NHẬN lựa chọn — service KHÔNG nạp model ở đây.
          if (typeof body?.preset === 'string') {
            svc.config = { ...svc.config, preset: body.preset as never, stages: [] }
          }
          const adapter = body?.customAsrAdapter
          if (typeof adapter === 'string' && svc.config.custom) {
            const models = svc.config.custom.asrModelChoices[adapter] ?? []
            svc.config = {
              ...svc.config,
              custom: { ...svc.config.custom, asrAdapter: adapter, asrModel: models[0] ?? '' }
            }
          }
          const model = body?.customAsrModel
          if (typeof model === 'string' && svc.config.custom) {
            const allowed = svc.config.custom.asrModelChoices[svc.config.custom.asrAdapter] ?? []
            if (!allowed.includes(model)) {
              return json({ detail: `${model} không chạy được trên runtime này.` }, 400)
            }
            svc.config = { ...svc.config, custom: { ...svc.config.custom, asrModel: model } }
          }
          return json(svc.config)
        }
        case 'GET /api/models':
          return json(svc.models)
        case 'GET /api/models/progress':
          return json(svc.progress)
        case 'POST /api/models/load':
          svc.config = { ...svc.config, stages: LOADED_STAGES }
          return json(svc.config)
        case 'POST /api/models/unload':
          svc.config = { ...svc.config, stages: [] }
          return json(svc.config)
        case 'POST /api/models/load/cancel':
          return new Response(null, { status: 204 })
        case 'POST /api/models/download':
          return json({ name: String(body?.name), stage: 'ASR', path: `/models/${body?.name}` })
        case 'DELETE /api/models/one': {
          const target = url.searchParams.get('path')
          svc.models = svc.models.filter((m) => m.path !== target)
          return json({ removed: [String(target)], freedBytes: 1024 })
        }
        case 'DELETE /api/models':
          svc.models = []
          return json({ removed: ['whisper-cpp'], freedBytes: 2048 })
        case 'GET /api/storage':
          return json({ items: [{ key: 'models', path: '/models', sizeBytes: 0 }], totalBytes: 0 })
        default:
          return json({ detail: `Test chưa dựng route ${route}` }, 501)
      }
    })
  )

  return svc
}

export function renderScreen(ui: ReactElement): RenderResult {
  // QueryClient mới cho MỖI test: cache dùng chung sẽ khiến test này thấy dữ liệu
  // của test trước, và thứ tự chạy trở thành một phần của kết quả.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

/** Response lỗi giống hệt service thật: mã HTTP + `detail` tiếng Việt. */
export function errorResponse(status: number, detail: string): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

/** Đưa store Zustand về mặc định — nó là singleton mức module, không tự reset. */
export function resetStores(): void {
  useUiStore.setState({ screen: 'models', uiLanguage: 'vi' })
}
