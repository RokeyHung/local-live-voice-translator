// Cấu hình kết nối tới Local AI Service.
// Giá trị do Electron preload cung cấp; fallback khi chạy trên trình duyệt thuần.

export const AI_BASE_URL = window.llvt?.aiBaseUrl ?? 'http://127.0.0.1:8756'
export const AI_WS_URL = window.llvt?.aiWsUrl ?? 'ws://127.0.0.1:8756/ws'
export const PLATFORM = window.llvt?.platform ?? 'web'

// Hộp thoại chọn thư mục của hệ điều hành (qua preload). Trả '' khi huỷ hoặc khi
// chạy ngoài Electron — nơi gọi vẫn còn ô nhập tay để dùng.
export function chooseDirectory(current?: string): Promise<string> {
  return window.llvt?.chooseDirectory?.(current) ?? Promise.resolve('')
}
