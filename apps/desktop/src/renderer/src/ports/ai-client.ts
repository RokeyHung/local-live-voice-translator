// Port: client REST tới Local AI Service.

import type { Language, Preset } from '../domain/enums'
import type {
  BenchmarkResponse,
  ConfigResponse,
  HealthResponse,
  InstalledModel,
  ResourceResponse
} from '../domain/models'

export interface AiClient {
  fetchHealth(): Promise<HealthResponse>
  fetchConfig(): Promise<ConfigResponse>
  updatePreset(preset: Preset): Promise<ConfigResponse>
  // Chạy một câu mẫu qua từng khâu để đo độ trễ thực tế của máy.
  runBenchmark(source: Language, target: Language): Promise<BenchmarkResponse>
  fetchResources(): Promise<ResourceResponse>
  // Model đã tải thật trên đĩa của máy.
  fetchInstalledModels(): Promise<InstalledModel[]>
}
