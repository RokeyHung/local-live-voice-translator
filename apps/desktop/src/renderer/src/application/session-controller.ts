// Use-case: điều phối kênh phiên, thu mic và phát TTS; cập nhật store.
// Chỉ phụ thuộc PORT (SessionChannel, AudioCapture, AudioOutput), không phụ thuộc adapter.

import type { WsMessage } from '../domain/events'
import type { SessionConfig } from '../domain/models'
import type { AudioCapture, AudioFrame } from '../ports/audio-capture'
import type { AudioOutput } from '../ports/audio-output'
import type { SessionChannel } from '../ports/session-channel'
import { useSessionStore } from '../stores/session-store'

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
  }

  async start(): Promise<void> {
    const store = useSessionStore.getState()
    const config = store.config
    this.seq = 0
    store.clearTranscript()
    this.channel.send('session.start', sessionStartPayload(config))
    store.setActive(true)

    if (this.capture && config.mode !== 'listen') {
      try {
        await this.capture.start((frame) => this.sendAudio(frame))
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

  stop(): void {
    this.capture?.stop()
    this.output?.stop()
    this.channel.send('session.stop')
    useSessionStore.getState().setActive(false)
  }

  dispose(): void {
    this.capture?.stop()
    this.output?.stop()
    this.channel.close()
  }
}
