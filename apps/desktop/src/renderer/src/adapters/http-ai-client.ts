// Adapter: hiện thực AiClient bằng fetch tới REST.

import { AI_BASE_URL } from '../application/config'
import type { HealthResponse } from '../domain/models'
import type { AiClient } from '../ports/ai-client'

export class HttpAiClient implements AiClient {
  async fetchHealth(): Promise<HealthResponse> {
    const res = await fetch(`${AI_BASE_URL}/health`)
    if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`)
    return (await res.json()) as HealthResponse
  }
}
