// Use-case: điều phối kênh phiên, thu mic và phát TTS; cập nhật store.
// Chỉ phụ thuộc PORT (SessionChannel, AudioCapture, AudioOutput), không phụ thuộc adapter.

import type { ErrorPayload, WsMessage } from '../domain/events'
import type { SessionConfig } from '../domain/models'
import type { AudioCapture, AudioFrame } from '../ports/audio-capture'
import type { AudioOutput } from '../ports/audio-output'
import type { SessionChannel } from '../ports/session-channel'
import { useSessionStore } from '../stores/session-store'
import { useUiStore } from '../stores/ui-store'
import { dict, format } from './i18n'
import { logError, logInfo, logWarn } from './logger'

function toBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function pcm16FromBase64(b64: string): Int16Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 2))
}

function rms(pcm: Int16Array): number {
  if (pcm.length === 0) return 0
  let sum = 0
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i] / 32768
    sum += v * v
  }
  return Math.sqrt(sum / pcm.length)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// Tên mặc định của phiên trong lịch sử; đổi được sau ở màn Lịch sử.
function defaultTitle(prefix: string, at: Date): string {
  return `${prefix}_${pad(at.getDate())}_${pad(at.getMonth() + 1)}_${at.getFullYear()}_${pad(at.getHours())}${pad(at.getMinutes())}`
}

function sessionStartPayload(config: SessionConfig, title: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    mode: config.mode,
    preset: config.preset,
    title,
    reviewBeforeSpeaking: config.reviewBeforeSpeaking
  }
  if (config.mode !== 'listen') {
    payload.outgoingSource = config.outgoing.source
    payload.outgoingTarget = config.outgoing.target
  }
  if (config.mode !== 'speak') {
    payload.incomingSource = config.incoming.source
    payload.incomingTarget = config.incoming.target
  }
  return payload
}

export class SessionController {
  private seq = 0
  private pttActive = false // Push-to-talk: mic chỉ gửi khi đang giữ nút.
  private muted = false

  constructor(
    private readonly channel: SessionChannel,
    private readonly mic?: AudioCapture,
    private readonly systemAudio?: AudioCapture,
    private readonly output?: AudioOutput
  ) {}

  connect(): void {
    const store = useSessionStore.getState()
    store.setWsStatus('connecting')
    this.channel.connect({
      onOpen: () => {
        useSessionStore.getState().setWsStatus('connected')
        logInfo('session', (L) => L.logWsOpen)
      },
      onEvent: (msg) => this.onEvent(msg),
      onClose: () => {
        useSessionStore.getState().setWsStatus('disconnected')
        logWarn('session', (L) => L.logWsClosed)
      },
      onError: () => useSessionStore.getState().setWsStatus('disconnected')
    })
  }

  private onEvent(msg: WsMessage): void {
    useSessionStore.getState().applyMessage(msg)
    // Lỗi từ service đi thẳng vào nhật ký nguyên mã lỗi: đó là thứ cần khi gỡ rối,
    // và mã lỗi thì không dịch được sang tiếng người theo cách có ích hơn.
    if (msg.type === 'error') {
      const e = msg.payload as unknown as ErrorPayload
      logError('session', () => `${e.code}: ${e.message}`)
    }
    if (msg.type === 'tts.audio' && this.output) {
      const p = msg.payload as { pcm?: string; sampleRate?: number }
      if (p.pcm)
        this.output.play({ pcm: pcm16FromBase64(p.pcm), sampleRate: p.sampleRate ?? 22050 })
    }
    // Câu hoàn tất KHÔNG cần ghi lại ở đây: service đã lưu vào lịch sử (SQLite) ngay
    // khi chạy xong pipeline, và màn Lịch sử đọc trực tiếp từ đó.
  }

  async start(): Promise<void> {
    const store = useSessionStore.getState()
    const ui = useUiStore.getState()
    const config = store.config
    this.seq = 0
    this.pttActive = false
    this.muted = false
    store.setMuted(false)
    store.setPtt(false)
    store.clearTranscript()
    // Trỏ đầu ra TTS tới thiết bị đã chọn (microphone ảo) trước khi phát.
    await this.output?.setSink(ui.virtualMicDeviceId || ui.outputDeviceId)
    const title = defaultTitle(dict(ui.uiLanguage).meetingPrefix, new Date())
    // "Duyệt trước khi gửi" là tuỳ chọn người dùng (màn Cài đặt) chứ không phải một
    // phần của cặp ngôn ngữ, nên nó sống ở ui-store; chốt lại tại đây, lúc mở phiên.
    // Đổi giữa phiên không có tác dụng — service đã dựng pipeline theo giá trị này.
    const startConfig = { ...config, reviewBeforeSpeaking: ui.reviewBeforeSpeaking }
    store.setConfig({ reviewBeforeSpeaking: ui.reviewBeforeSpeaking })
    this.channel.send('session.start', sessionStartPayload(startConfig, title))
    store.setActive(true)
    logInfo('session', (L) => format(L.logSessionStart, { title }))

    // Chiều outgoing: mic của mình (bị gate bởi PTT/mute).
    if (this.mic && config.mode !== 'listen') {
      try {
        await this.mic.start((frame) => this.sendMic(frame), ui.inputDeviceId)
      } catch (err) {
        this.reportError('mic_error', err)
      }
    }

    // Chiều incoming: âm thanh hệ thống (giọng phía cuộc họp), chạy liên tục.
    // Không thu được thì phiên vẫn tiếp tục ở chiều outgoing — chỉ báo lỗi.
    if (this.systemAudio && config.mode !== 'speak') {
      try {
        await this.systemAudio.start((frame) => this.sendSystem(frame))
        useSessionStore.getState().setSystemCapturing(true)
      } catch (err) {
        this.reportError('system_audio_error', err)
      }
    }
  }

  private reportError(code: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err)
    // Lỗi dựng ở client nên không đi qua onEvent — phải tự ghi vào nhật ký.
    logError('session', () => `${code}: ${message}`)
    useSessionStore
      .getState()
      .applyMessage({ type: 'error', ts: Date.now(), payload: { code, message } })
  }

  private sendMic(frame: AudioFrame): void {
    // Mức tín hiệu hiển thị cả khi chưa giữ PTT (để thấy mic có vào hay không).
    useSessionStore.getState().setMicLevel(rms(frame.pcm))
    // Chỉ gửi khi đang giữ PTT và không mute (server cũng gate lại, phòng hờ).
    if (!this.pttActive || this.muted) return
    this.sendChunk('microphone', frame)
  }

  private sendSystem(frame: AudioFrame): void {
    const level = rms(frame.pcm)
    useSessionStore.getState().setSystemLevel(level)
    // Chống vòng lặp: loopback thu toàn bộ đầu ra của hệ điều hành, nên nếu TTS
    // đang phát ra loa (thay vì chỉ ra micro ảo) thì chính giọng dịch của mình
    // sẽ quay lại chiều incoming và bị dịch tiếp. Bỏ khung trong lúc đang phát.
    if (this.output?.isPlaying()) {
      useSessionStore.getState().setDucking(true)
      return
    }
    useSessionStore.getState().setDucking(false)
    this.sendChunk('system', frame)
  }

  private sendChunk(source: 'microphone' | 'system', frame: AudioFrame): void {
    this.channel.send('audio.chunk', {
      source,
      pcm: toBase64(frame.pcm),
      seq: this.seq++,
      sampleRate: frame.sampleRate
    })
  }

  ptt(pressed: boolean): void {
    this.pttActive = pressed
    this.channel.send('control.ptt', { pressed })
    useSessionStore.getState().setPtt(pressed)
  }

  /** Duyệt một câu đang chờ (SPEC 7.10): gửi bản đã sửa đi đọc ra micro ảo. */
  confirm(utteranceId: string, text: string): void {
    this.channel.send('control.confirm', { utteranceId, text })
    useSessionStore.getState().resolveReview(utteranceId)
  }

  /** Bỏ một câu đang chờ: không đọc ra, nhưng vẫn giữ trong lịch sử. */
  discard(utteranceId: string): void {
    this.channel.send('control.discard', { utteranceId })
    useSessionStore.getState().resolveReview(utteranceId)
  }

  mute(muted: boolean): void {
    this.muted = muted
    this.channel.send('control.mute', { muted })
    useSessionStore.getState().setMuted(muted)
    // Bật mute: cắt ngay TTS đang phát ra micro ảo (barge-in).
    if (muted) this.output?.stop()
  }

  stop(): void {
    this.pttActive = false
    this.muted = false
    this.mic?.stop()
    this.systemAudio?.stop()
    this.output?.stop()
    this.channel.send('session.stop')
    const store = useSessionStore.getState()
    store.setActive(false)
    store.setMuted(false)
    store.setPtt(false)
    store.setMicLevel(0)
    store.setSystemLevel(0)
    store.setSystemCapturing(false)
    store.setDucking(false)
    logInfo('session', (L) => L.logSessionStop)
  }

  dispose(): void {
    this.mic?.stop()
    this.systemAudio?.stop()
    this.output?.stop()
    this.channel.close()
  }
}
