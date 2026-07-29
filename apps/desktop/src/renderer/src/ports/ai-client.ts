// Port: client REST tới Local AI Service.

import type { Preset } from '../domain/enums'
import type { ConfigResponse, HealthResponse } from '../domain/models'

export interface AiClient {
  fetchHealth(): Promise<HealthResponse>
  fetchConfig(): Promise<ConfigResponse>
  updatePreset(preset: Preset): Promise<ConfigResponse>
}
