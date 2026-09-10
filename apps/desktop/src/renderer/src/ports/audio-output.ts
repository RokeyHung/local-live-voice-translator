// Port: phát audio TTS ra thiết bị đầu ra. Hiện thực đặt phía adapter.
// Chọn loa/tai nghe qua setSink().
//
// setSink() từng dùng để trỏ đầu ra tới microphone ảo (BlackHole/VB-CABLE) cho
// Google Meet nhận như micro của người dùng. Đường đó đã bỏ khỏi phạm vi đồ án —
// bản thân cơ chế vẫn giữ nguyên vì chọn loa/tai nghe cũng đi qua đây.

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
  // Còn audio đang phát hoặc đã xếp lịch phát (tính cả `tailMs` sau khi dứt tiếng).
  // Dùng để chặn vòng lặp: audio thu vào trong lúc này có thể chính là tiếng TTS.
  isPlaying(tailMs?: number): boolean
}
