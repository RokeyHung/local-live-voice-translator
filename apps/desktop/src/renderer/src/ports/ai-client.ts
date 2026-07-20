// Port: client REST tới Local AI Service.

import type { HealthResponse } from '../domain/models'

export interface AiClient {
  fetchHealth(): Promise<HealthResponse>
}
