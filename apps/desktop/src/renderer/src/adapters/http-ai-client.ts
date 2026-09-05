// Adapter: hiện thực AiClient bằng fetch tới REST.

import { AI_BASE_URL } from '../application/config'
import type { Language, Preset } from '../domain/enums'
import type {
  BenchmarkResponse,
  ConfigResponse,
  DeletedModels,
  HealthResponse,
  HfVerifyResult,
  HistorySession,
  HistorySessionDetail,
  InstalledModel,
  LoadProgress,
  ResourceResponse,
  StorageUsage,
  TranscribeProgress,
  TranscriptionResult
} from '../domain/models'
import type { AiClient, TranscribeRequest } from '../ports/ai-client'

export class HttpAiClient implements AiClient {
  async fetchHealth(): Promise<HealthResponse> {
    const res = await fetch(`${AI_BASE_URL}/health`)
    if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`)
    return (await res.json()) as HealthResponse
  }

  async fetchConfig(): Promise<ConfigResponse> {
    const res = await fetch(`${AI_BASE_URL}/api/config`)
    if (!res.ok) throw new Error(`Đọc cấu hình thất bại: HTTP ${res.status}`)
    return (await res.json()) as ConfigResponse
  }

  async updatePreset(preset: Preset): Promise<ConfigResponse> {
    const res = await fetch(`${AI_BASE_URL}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset })
    })
    if (!res.ok) throw new Error(`Đổi preset thất bại: HTTP ${res.status}`)
    return (await res.json()) as ConfigResponse
  }

  async setHistoryEnabled(preset: Preset, enabled: boolean): Promise<ConfigResponse> {
    // Gửi lại đúng preset đang chạy nên service không nạp lại model.
    const res = await fetch(`${AI_BASE_URL}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset, historyEnabled: enabled })
    })
    if (!res.ok) throw new Error(`Đổi chế độ lưu lịch sử thất bại: HTTP ${res.status}`)
    return (await res.json()) as ConfigResponse
  }

  async setHfToken(preset: Preset, token: string): Promise<ConfigResponse> {
    // Chuỗi rỗng = gỡ token đã lưu. Service không trả token về nên phần hiển thị
    // sau đó chỉ dựa vào `hfTokenSet`/`hfTokenHint`.
    const res = await fetch(`${AI_BASE_URL}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset, hfToken: token })
    })
    if (!res.ok) {
      // 409 khi LLVT_HF_TOKEN đang khoá — hiện nguyên văn lý do của service.
      const detail = await res.json().catch(() => null)
      throw new Error(detail?.detail ?? `Lưu token thất bại: HTTP ${res.status}`)
    }
    return (await res.json()) as ConfigResponse
  }

  async verifyHfToken(token: string): Promise<HfVerifyResult> {
    const res = await fetch(`${AI_BASE_URL}/api/hf/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
    if (!res.ok) throw new Error(`Kiểm tra token thất bại: HTTP ${res.status}`)
    return (await res.json()) as HfVerifyResult
  }

  async setModelsDir(preset: Preset, dir: string): Promise<ConfigResponse> {
    const res = await fetch(`${AI_BASE_URL}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset, modelsDir: dir })
    })
    if (!res.ok) {
      // Service trả lý do cụ thể (đường dẫn không ghi được, bị env khoá) — hiện nguyên văn.
      const detail = await res.json().catch(() => null)
      throw new Error(detail?.detail ?? `Đổi thư mục model thất bại: HTTP ${res.status}`)
    }
    return (await res.json()) as ConfigResponse
  }

  async loadModels(reload = false): Promise<ConfigResponse> {
    const res = await fetch(`${AI_BASE_URL}/api/models/load?reload=${reload}`, { method: 'POST' })
    if (!res.ok) {
      // 503 mang theo khâu nào hỏng và vì sao (hay gặp: mất mạng lúc tải model) —
      // "HTTP 503" trơ trọi thì người dùng không biết phải làm gì.
      const detail = await res.json().catch(() => null)
      throw new Error(detail?.detail ?? `Nạp model thất bại: HTTP ${res.status}`)
    }
    return (await res.json()) as ConfigResponse
  }

  async fetchLoadProgress(): Promise<LoadProgress> {
    const res = await fetch(`${AI_BASE_URL}/api/models/progress`)
    if (!res.ok) throw new Error(`Không lấy được tiến trình nạp: HTTP ${res.status}`)
    return (await res.json()) as LoadProgress
  }

  async unloadModels(): Promise<ConfigResponse> {
    const res = await fetch(`${AI_BASE_URL}/api/models/unload`, { method: 'POST' })
    if (!res.ok) throw new Error(`Giải phóng model thất bại: HTTP ${res.status}`)
    return (await res.json()) as ConfigResponse
  }

  async deleteInstalledModels(): Promise<DeletedModels> {
    const res = await fetch(`${AI_BASE_URL}/api/models`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`Xoá model thất bại: HTTP ${res.status}`)
    return (await res.json()) as DeletedModels
  }

  async runBenchmark(source: Language, target: Language): Promise<BenchmarkResponse> {
    const res = await fetch(`${AI_BASE_URL}/api/benchmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, target })
    })
    if (!res.ok) throw new Error(`Đo độ trễ thất bại: HTTP ${res.status}`)
    return (await res.json()) as BenchmarkResponse
  }

  async fetchResources(): Promise<ResourceResponse> {
    const res = await fetch(`${AI_BASE_URL}/api/resources`)
    if (!res.ok) throw new Error(`Đọc tài nguyên thất bại: HTTP ${res.status}`)
    return (await res.json()) as ResourceResponse
  }

  async fetchInstalledModels(): Promise<InstalledModel[]> {
    const res = await fetch(`${AI_BASE_URL}/api/models`)
    if (!res.ok) throw new Error(`Đọc danh sách model thất bại: HTTP ${res.status}`)
    return (await res.json()) as InstalledModel[]
  }

  async fetchStorage(): Promise<StorageUsage> {
    const res = await fetch(`${AI_BASE_URL}/api/storage`)
    if (!res.ok) throw new Error(`Đọc dung lượng đĩa thất bại: HTTP ${res.status}`)
    return (await res.json()) as StorageUsage
  }

  async transcribeFile({
    pcm,
    name,
    source,
    target,
    save,
    diarize
  }: TranscribeRequest): Promise<TranscriptionResult> {
    // Gửi thẳng PCM thô: tệp đã được giải mã ở renderer (Chromium có sẵn bộ giải mã
    // MP3/M4A/FLAC/OGG/WebM), nên service không phải kèm ffmpeg trong bản cài.
    const params = new URLSearchParams({
      source,
      name,
      save: String(save),
      diarize: String(diarize)
    })
    if (target) params.set('target', target)
    const res = await fetch(`${AI_BASE_URL}/api/transcribe?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: pcm
    })
    if (!res.ok) {
      // Service nói rõ lý do (tệp hỏng, model không nạp được, đang bận tệp khác).
      const detail = await res.json().catch(() => null)
      throw new Error(detail?.detail ?? `Chuyển tệp thành văn bản thất bại: HTTP ${res.status}`)
    }
    return (await res.json()) as TranscriptionResult
  }

  async cancelTranscribe(): Promise<void> {
    const res = await fetch(`${AI_BASE_URL}/api/transcribe/cancel`, { method: 'POST' })
    if (!res.ok) throw new Error(`Không dừng được lượt nhập tệp: HTTP ${res.status}`)
  }

  async fetchTranscribeProgress(): Promise<TranscribeProgress> {
    const res = await fetch(`${AI_BASE_URL}/api/transcribe/progress`)
    if (!res.ok) throw new Error(`Không lấy được tiến trình nhập tệp: HTTP ${res.status}`)
    return (await res.json()) as TranscribeProgress
  }

  async fetchSessions(query?: string): Promise<HistorySession[]> {
    const q = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''
    const res = await fetch(`${AI_BASE_URL}/api/sessions${q}`)
    if (!res.ok) throw new Error(`Đọc lịch sử thất bại: HTTP ${res.status}`)
    return (await res.json()) as HistorySession[]
  }

  async fetchSession(id: string): Promise<HistorySessionDetail> {
    const res = await fetch(`${AI_BASE_URL}/api/sessions/${encodeURIComponent(id)}`)
    if (!res.ok) throw new Error(`Đọc bản ghi phiên thất bại: HTTP ${res.status}`)
    return (await res.json()) as HistorySessionDetail
  }

  async renameSession(id: string, title: string): Promise<HistorySession> {
    const res = await fetch(`${AI_BASE_URL}/api/sessions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    })
    if (!res.ok) throw new Error(`Đổi tên phiên thất bại: HTTP ${res.status}`)
    return (await res.json()) as HistorySession
  }

  async closeSession(id: string): Promise<HistorySession> {
    const res = await fetch(`${AI_BASE_URL}/api/sessions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ close: true })
    })
    if (!res.ok) throw new Error(`Đóng phiên thất bại: HTTP ${res.status}`)
    return (await res.json()) as HistorySession
  }

  async deleteSession(id: string): Promise<void> {
    const res = await fetch(`${AI_BASE_URL}/api/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
    if (!res.ok) throw new Error(`Xoá phiên thất bại: HTTP ${res.status}`)
  }

  async deleteAllSessions(): Promise<void> {
    const res = await fetch(`${AI_BASE_URL}/api/sessions`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`Xoá lịch sử thất bại: HTTP ${res.status}`)
  }
}
