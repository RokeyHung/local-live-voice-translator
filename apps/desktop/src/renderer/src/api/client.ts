import { AI_BASE_URL } from './config'
import type { HealthResponse } from './protocol'

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${AI_BASE_URL}/health`)
  if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`)
  return (await res.json()) as HealthResponse
}
