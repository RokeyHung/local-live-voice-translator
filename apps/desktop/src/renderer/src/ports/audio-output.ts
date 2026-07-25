// Port: phát audio TTS ra thiết bị đầu ra. Hiện thực đặt phía adapter.
// Đầu ra có thể trỏ tới microphone ảo (BlackHole/VB-CABLE) để Google Meet nhận
// như micro của người dùng — chọn thiết bị qua setSink().

export interface TtsChunk {
  pcm: Int16Array
  sampleRate: number
}

export interface AudioOutput {
  // Xếp hàng và phát một đoạn PCM (tuần tự, không chồng tiếng).
  play(chunk: TtsChunk): void
  // Dừng phát và xóa hàng đợi.
  stop(): void
  // Chọn thiết bị đầu ra theo deviceId (rỗng = thiết bị mặc định của hệ điều hành).
  setSink(deviceId: string): Promise<void>
}
