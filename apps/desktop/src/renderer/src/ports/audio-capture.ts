// Port: thu audio từ một nguồn (microphone/system) thành khung PCM 16-bit.
// Hiện thực đặt phía adapter; application/UI chỉ phụ thuộc port này.

export interface AudioFrame {
  pcm: Int16Array
  sampleRate: number
}

export interface AudioCapture {
  // Bắt đầu thu; mỗi khung audio gọi lại onFrame. Có thể ném lỗi nếu không có quyền.
  start(onFrame: (frame: AudioFrame) => void): Promise<void>
  stop(): void
}
