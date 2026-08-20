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
  LoadProgress,
  ResourceResponse,
  TranscribeProgress,
  TranscriptionResult
} from '../domain/models'

// Một tệp đã giải mã sẵn thành PCM 16-bit mono 16 kHz, kèm tên để đặt tên phiên.
export interface TranscribeRequest {
  pcm: ArrayBuffer
  name: string
  source: Language
  target: Language | null // null = chỉ nhận dạng chữ, không dịch
  save: boolean // lưu kết quả thành một phiên trong lịch sử
}

export interface AiClient {
  fetchHealth(): Promise<HealthResponse>
  fetchConfig(): Promise<ConfigResponse>
  updatePreset(preset: Preset): Promise<ConfigResponse>
  // Bật/tắt lưu lịch sử (không nạp lại model).
  setHistoryEnabled(preset: Preset, enabled: boolean): Promise<ConfigResponse>
  // Đổi thư mục lưu model; service lưu lại và giải phóng model đang nạp.
  setModelsDir(preset: Preset, dir: string): Promise<ConfigResponse>
  // Nạp model vào bộ nhớ (service không nạp lúc khởi động). Có thể mất vài phút lần đầu.
  loadModels(reload?: boolean): Promise<ConfigResponse>
  // Tiến trình của lượt nạp đang chạy (hỏi song song với loadModels).
  fetchLoadProgress(): Promise<LoadProgress>
  unloadModels(): Promise<ConfigResponse>
  // Xoá model đã tải để lấy lại dung lượng đĩa.
  deleteInstalledModels(): Promise<DeletedModels>
  // Chạy một câu mẫu qua từng khâu để đo độ trễ thực tế của máy.
  runBenchmark(source: Language, target: Language): Promise<BenchmarkResponse>
  fetchResources(): Promise<ResourceResponse>
  // Model đã tải thật trên đĩa của máy.
  fetchInstalledModels(): Promise<InstalledModel[]>

  // --- Nhập tệp (xử lý theo lô, không phải luồng realtime) ---
  // Chặn tới khi chạy xong cả tệp; hỏi song song fetchTranscribeProgress() để hiện tiến trình.
  transcribeFile(request: TranscribeRequest): Promise<TranscriptionResult>
  fetchTranscribeProgress(): Promise<TranscribeProgress>
  // Xin dừng tệp đang chạy: `transcribeFile` vẫn trả về bình thường, với phần đã
  // chạy được và `cancelled: true` — huỷ không có nghĩa là vứt kết quả dở dang đi.
  cancelTranscribe(): Promise<void>

  // --- Lịch sử phiên (lưu trong SQLite của service) ---
  fetchSessions(query?: string): Promise<HistorySession[]>
  fetchSession(id: string): Promise<HistorySessionDetail>
  renameSession(id: string, title: string): Promise<HistorySession>
  // Đóng phiên bị bỏ dở (app tắt giữa phiên) — mốc kết thúc lấy theo câu cuối.
  closeSession(id: string): Promise<HistorySession>
  deleteSession(id: string): Promise<void>
  deleteAllSessions(): Promise<void>
}
