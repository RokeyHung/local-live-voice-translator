// Adapter: hiện thực AiClient bằng fetch tới REST.

import { AI_BASE_URL } from '../application/config'
import type { Preset } from '../domain/enums'
import type { ConfigResponse, HealthResponse } from '../domain/models'
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
}
