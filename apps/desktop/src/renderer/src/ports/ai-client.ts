// Port: client REST tới Local AI Service.

import type { Language, Preset } from '../domain/enums'
import type {
  BenchmarkResponse,
  ConfigResponse,
  DeletedModels,
  DownloadedModel,
  EvaluationCase,
  EvaluationProgress,
  EvaluationResult,
  HealthResponse,
  HfVerifyResult,
  HistorySession,
  HistorySessionDetail,
  InstalledModel,
  LoadProgress,
  ResourceResponse,
  StorageUsage,
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
  // Gắn nhãn người nói. Service bỏ qua nếu chưa bật diarization; đặt false để không
  // chạy khâu này cho riêng tệp đang gửi (nó tốn thêm một lượt quét cả tệp).
  diarize: boolean
}

export interface AiClient {
  fetchHealth(): Promise<HealthResponse>
  fetchConfig(): Promise<ConfigResponse>
  updatePreset(preset: Preset): Promise<ConfigResponse>
  // Bật/tắt lưu lịch sử (không nạp lại model).
  setHistoryEnabled(preset: Preset, enabled: boolean): Promise<ConfigResponse>
  // Đổi thư mục lưu model; service lưu lại và giải phóng model đang nạp.
  setModelsDir(preset: Preset, dir: string): Promise<ConfigResponse>
  // Lựa chọn model cho preset 'custom'; khoá nào bỏ trống là giữ nguyên.
  setCustomModels(
    preset: Preset,
    choice: { asrAdapter?: string; asrModel?: string; mtModel?: string }
  ): Promise<ConfigResponse>
  // Dừng lượt nạp đang chạy (dừng ở ranh giới khâu kế tiếp).
  cancelLoadModels(): Promise<void>
  // Tải một model về đĩa, KHÔNG nạp vào bộ nhớ. `kind` chỉ cần khi model nằm ngoài
  // danh mục (một repo HuggingFace bất kỳ) — service không suy ra được runtime.
  // `force` xoá bản đang có rồi tải lại từ đầu — lối thoát cho bản tải dở, vì
  // service bỏ qua model "đã có".
  downloadModel(name: string, kind?: string, force?: boolean): Promise<DownloadedModel>
  // Xoá đúng một model đã tải, theo `path` mà GET /api/models trả về.
  deleteInstalledModel(path: string): Promise<DeletedModels>
  // Lưu access token HuggingFace ở phía service (chuỗi rỗng = gỡ token đã lưu).
  // Token không bao giờ đi ngược lại về renderer.
  setHfToken(preset: Preset, token: string): Promise<ConfigResponse>
  // Hỏi huggingface.co xem token có dùng được không. Bỏ trống `token` để kiểm tra
  // cái đang có hiệu lực; truyền giá trị để thử trước khi lưu.
  verifyHfToken(token: string): Promise<HfVerifyResult>
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
  // Dung lượng đĩa service đang chiếm, tách theo từng kho (model, lịch sử).
  fetchStorage(): Promise<StorageUsage>

  // --- Nhập tệp (xử lý theo lô, không phải luồng realtime) ---
  // Chặn tới khi chạy xong cả tệp; hỏi song song fetchTranscribeProgress() để hiện tiến trình.
  transcribeFile(request: TranscribeRequest): Promise<TranscriptionResult>
  fetchTranscribeProgress(): Promise<TranscribeProgress>
  // Xin dừng tệp đang chạy: `transcribeFile` vẫn trả về bình thường, với phần đã
  // chạy được và `cancelled: true` — huỷ không có nghĩa là vứt kết quả dở dang đi.
  cancelTranscribe(): Promise<void>

  // --- Đánh giá (GVHD biên bản 19/08 mục 3d) ---
  // Bộ câu mẫu đi kèm service — đúng bộ mà `make accuracy` dùng.
  fetchEvaluationCorpus(): Promise<EvaluationCase[]>
  // Chạy và chấm; chặn tới khi xong nên hỏi tiến trình song song.
  runEvaluation(cases: EvaluationCase[], limit?: number): Promise<EvaluationResult>
  fetchEvaluationProgress(): Promise<EvaluationProgress>
  // Dừng ở ranh giới câu; `runEvaluation` vẫn trả phần đã chấm xong.
  cancelEvaluation(): Promise<void>

  // --- Lịch sử phiên (lưu trong SQLite của service) ---
  fetchSessions(query?: string): Promise<HistorySession[]>
  fetchSession(id: string): Promise<HistorySessionDetail>
  renameSession(id: string, title: string): Promise<HistorySession>
  // Đóng phiên bị bỏ dở (app tắt giữa phiên) — mốc kết thúc lấy theo câu cuối.
  closeSession(id: string): Promise<HistorySession>
  deleteSession(id: string): Promise<void>
  deleteAllSessions(): Promise<void>
}
