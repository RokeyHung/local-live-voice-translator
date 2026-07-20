// Cấu hình kết nối tới Local AI Service.
// Giá trị do Electron preload cung cấp; fallback khi chạy trên trình duyệt thuần.

export const AI_BASE_URL = window.llvt?.aiBaseUrl ?? 'http://127.0.0.1:8756'
export const AI_WS_URL = window.llvt?.aiWsUrl ?? 'ws://127.0.0.1:8756/ws'
export const PLATFORM = window.llvt?.platform ?? 'web'
