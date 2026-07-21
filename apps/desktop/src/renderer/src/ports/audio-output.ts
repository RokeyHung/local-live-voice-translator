// Port: phát audio TTS ra thiết bị đầu ra. Hiện thực đặt phía adapter.
// (Định tuyến vào microphone ảo BlackHole/VB-CABLE là bước OS-native, đợt sau.)

export interface TtsChunk {
  pcm: Int16Array
  sampleRate: number
}

export interface AudioOutput {
  // Xếp hàng và phát một đoạn PCM (tuần tự, không chồng tiếng).
  play(chunk: TtsChunk): void
  // Dừng phát và xóa hàng đợi.
  stop(): void
}
