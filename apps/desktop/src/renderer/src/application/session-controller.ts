// Use-case: điều phối kênh phiên và cập nhật store (tương tự SessionController bên ai-service).
// Chỉ phụ thuộc PORT (SessionChannel, AudioCapture), không phụ thuộc adapter cụ thể.

import type { AudioCapture, AudioFrame } from '../ports/audio-capture'
import type { SessionChannel } from '../ports/session-channel'
import { useSessionStore } from '../stores/session-store'

// Mặc định Tuần 2: chiều outgoing (mic → remote) để AI service tạo pipeline chạy VAD.
// Việc chọn ngôn ngữ trong UI thuộc giai đoạn sau.
const DEFAULT_OUTGOING = { outgoingSource: 'vi', outgoingTarget: 'en' }
const DEFAULT_INCOMING = { incomingSource: 'en', incomingTarget: 'vi' }

function toBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export class SessionController {
  private seq = 0

  constructor(
    private readonly channel: SessionChannel,
    private readonly capture?: AudioCapture
  ) {}

  connect(): void {
    const store = useSessionStore.getState()
    store.setWsStatus('connecting')
    this.channel.connect({
      onOpen: () => useSessionStore.getState().setWsStatus('connected'),
      onEvent: (msg) => useSessionStore.getState().pushMessage(msg),
      onClose: () => useSessionStore.getState().setWsStatus('disconnected'),
      onError: () => useSessionStore.getState().setWsStatus('disconnected')
    })
  }

  async startSession(mode: string = 'two_way'): Promise<void> {
    this.seq = 0
    this.channel.send('session.start', {
      mode,
      ...DEFAULT_OUTGOING,
      ...(mode === 'two_way' ? DEFAULT_INCOMING : {})
    })
    if (this.capture && mode !== 'listen') {
      try {
        await this.capture.start((frame) => this.sendAudio(frame))
      } catch (err) {
        useSessionStore.getState().pushMessage({
          type: 'error',
          ts: Date.now(),
          payload: { code: 'mic_error', message: String(err) }
        })
      }
    }
  }

  private sendAudio(frame: AudioFrame): void {
    this.channel.send('audio.chunk', {
      source: 'microphone',
      pcm: toBase64(frame.pcm),
      seq: this.seq++,
      sampleRate: frame.sampleRate
    })
  }

  ptt(pressed: boolean): void {
    this.channel.send('control.ptt', { pressed })
  }

  stopSession(): void {
    this.capture?.stop()
    this.channel.send('session.stop')
  }

  dispose(): void {
    this.capture?.stop()
    this.channel.close()
  }
}
