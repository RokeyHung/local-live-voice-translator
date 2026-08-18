// Adapter: hiện thực AiClient bằng fetch tới REST.

import { AI_BASE_URL } from '../application/config'
import type { Language, Preset } from '../domain/enums'
import type {
  BenchmarkResponse,
  ConfigResponse,
  HealthResponse,
  HistorySession,
  HistorySessionDetail,
  InstalledModel,
  ResourceResponse
} from '../domain/models'
import type { AiClient } from '../ports/ai-client'

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
