// Adapter: hiện thực AiClient bằng fetch tới REST.

import { AI_BASE_URL } from '../application/config'
import type { Language, Preset } from '../domain/enums'
import type {
  BenchmarkResponse,
  ConfigResponse,
  HealthResponse,
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
}
