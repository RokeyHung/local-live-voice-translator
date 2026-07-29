// Use-case: điều phối kênh phiên, thu mic và phát TTS; cập nhật store.
// Chỉ phụ thuộc PORT (SessionChannel, AudioCapture, AudioOutput), không phụ thuộc adapter.

import type { WsMessage } from '../domain/events'
import type { MeetingRow, SessionConfig } from '../domain/models'
import type { AudioCapture, AudioFrame } from '../ports/audio-capture'
import type { AudioOutput } from '../ports/audio-output'
import type { SessionChannel } from '../ports/session-channel'
import { useMeetingStore } from '../stores/meeting-store'
import { useSessionStore } from '../stores/session-store'
import { useUiStore } from '../stores/ui-store'
import { applyGlossary } from './glossary'
import { dict } from './i18n'
import { utteranceSide } from './utterances'

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

function sessionStartPayload(config: SessionConfig): Record<string, unknown> {
  const payload: Record<string, unknown> = { mode: config.mode, preset: config.preset }
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
    private readonly capture?: AudioCapture,
    private readonly output?: AudioOutput
  ) {}

  connect(): void {
    const store = useSessionStore.getState()
    store.setWsStatus('connecting')
    this.channel.connect({
      onOpen: () => useSessionStore.getState().setWsStatus('connected'),
      onEvent: (msg) => this.onEvent(msg),
      onClose: () => useSessionStore.getState().setWsStatus('disconnected'),
      onError: () => useSessionStore.getState().setWsStatus('disconnected')
    })
  }

  private onEvent(msg: WsMessage): void {
    useSessionStore.getState().applyMessage(msg)
    if (msg.type === 'tts.audio' && this.output) {
      const p = msg.payload as { pcm?: string; sampleRate?: number }
      if (p.pcm)
        this.output.play({ pcm: pcm16FromBase64(p.pcm), sampleRate: p.sampleRate ?? 22050 })
    }
    // Câu đã chạy hết pipeline → ghi vào cuộc họp đang mở.
    if (msg.type === 'state') {
      const p = msg.payload as { state?: string; utteranceId?: string }
      if (p.state === 'Completed' && p.utteranceId) this.recordUtterance(p.utteranceId)
    }
  }

  private recordUtterance(utteranceId: string): void {
    const session = useSessionStore.getState()
    const utterance = session.utterances.find((u) => u.id === utteranceId)
    if (!utterance || !utterance.sourceText) return

    const row: MeetingRow = {
      id: utterance.id,
      side: utteranceSide(utterance, session.config),
      atMs: utterance.at,
      sourceLanguage: utterance.sourceLanguage,
      targetLanguage: utterance.targetLanguage,
      sourceText: utterance.sourceText,
      translatedText: applyGlossary(utterance.translatedText ?? '', useUiStore.getState().glossary),
      asrMs: utterance.asrMs,
      mtMs: utterance.mtMs,
      ttsMs: utterance.ttsMs
    }
    useMeetingStore.getState().appendRow(row)
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
    useMeetingStore.getState().startMeeting(dict(ui.uiLanguage).meetingPrefix)
    // Trỏ đầu ra TTS tới thiết bị đã chọn (microphone ảo) trước khi phát.
    await this.output?.setSink(ui.virtualMicDeviceId || ui.outputDeviceId)
    this.channel.send('session.start', sessionStartPayload(config))
    store.setActive(true)

    if (this.capture && config.mode !== 'listen') {
      try {
        await this.capture.start((frame) => this.sendAudio(frame), ui.inputDeviceId)
      } catch (err) {
        useSessionStore.getState().applyMessage({
          type: 'error',
          ts: Date.now(),
          payload: { code: 'mic_error', message: String(err) }
        })
      }
    }
  }

  private sendAudio(frame: AudioFrame): void {
    // Mức tín hiệu hiển thị cả khi chưa giữ PTT (để thấy mic có vào hay không).
    useSessionStore.getState().setMicLevel(rms(frame.pcm))
    // Chỉ gửi khi đang giữ PTT và không mute (server cũng gate lại, phòng hờ).
    if (!this.pttActive || this.muted) return
    this.channel.send('audio.chunk', {
      source: 'microphone',
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
    this.capture?.stop()
    this.output?.stop()
    this.channel.send('session.stop')
    const store = useSessionStore.getState()
    store.setActive(false)
    store.setMuted(false)
    store.setPtt(false)
    store.setMicLevel(0)
    useMeetingStore.getState().endMeeting()
  }

  dispose(): void {
    this.capture?.stop()
    this.output?.stop()
    this.channel.close()
  }
}
