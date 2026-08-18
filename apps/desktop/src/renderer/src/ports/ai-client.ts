// Port: client REST tới Local AI Service.

import type { Language, Preset } from '../domain/enums'
import type {
  BenchmarkResponse,
  ConfigResponse,
  DeletedModels,
  HealthResponse,
  HistorySession,
  HistorySessionDetail,
  InstalledModel,
  ResourceResponse
} from '../domain/models'

export interface AiClient {
  fetchHealth(): Promise<HealthResponse>
  fetchConfig(): Promise<ConfigResponse>
  updatePreset(preset: Preset): Promise<ConfigResponse>
  // Bật/tắt lưu lịch sử (không nạp lại model).
  setHistoryEnabled(preset: Preset, enabled: boolean): Promise<ConfigResponse>
  // Đổi thư mục lưu model; service lưu lại và giải phóng model đang nạp.
  setModelsDir(preset: Preset, dir: string): Promise<ConfigResponse>
  // Xoá model đã tải để lấy lại dung lượng đĩa.
  deleteInstalledModels(): Promise<DeletedModels>
  // Chạy một câu mẫu qua từng khâu để đo độ trễ thực tế của máy.
  runBenchmark(source: Language, target: Language): Promise<BenchmarkResponse>
  fetchResources(): Promise<ResourceResponse>
  // Model đã tải thật trên đĩa của máy.
  fetchInstalledModels(): Promise<InstalledModel[]>

  // --- Lịch sử phiên (lưu trong SQLite của service) ---
  fetchSessions(query?: string): Promise<HistorySession[]>
  fetchSession(id: string): Promise<HistorySessionDetail>
  renameSession(id: string, title: string): Promise<HistorySession>
  // Đóng phiên bị bỏ dở (app tắt giữa phiên) — mốc kết thúc lấy theo câu cuối.
  closeSession(id: string): Promise<HistorySession>
  deleteSession(id: string): Promise<void>
  deleteAllSessions(): Promise<void>
}
