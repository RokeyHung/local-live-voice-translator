// Mô hình nghiệp vụ phía client (thuần, không phụ thuộc React/transport).

import type { SessionMode } from './enums'

export interface HealthResponse {
  status: 'ok'
  version: string
  offlineReady: boolean
  platform: string
}

export interface SessionConfig {
  mode: SessionMode
}
