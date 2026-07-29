// Hook cầu nối: tạo SessionController (WS + mic + phát TTS) theo vòng đời component.

import { useEffect, useRef } from 'react'
import { MicCapture } from '../adapters/mic-capture'
import { SystemAudioCapture } from '../adapters/system-audio-capture'
import { TtsPlayer } from '../adapters/tts-player'
import { WsSessionChannel } from '../adapters/ws-session-channel'
import { SessionController } from '../application/session-controller'

export interface SessionActions {
  start: () => void
  ptt: (pressed: boolean) => void
  mute: (muted: boolean) => void
  stop: () => void
}

export function useSession(): SessionActions {
  const ref = useRef<SessionController | null>(null)

  useEffect(() => {
    const controller = new SessionController(
      new WsSessionChannel(),
      new MicCapture(),
      new SystemAudioCapture(),
      new TtsPlayer()
    )
    ref.current = controller
    controller.connect()
    return () => controller.dispose()
  }, [])

  return {
    start: () => void ref.current?.start(),
    ptt: (pressed) => ref.current?.ptt(pressed),
    mute: (muted) => ref.current?.mute(muted),
    stop: () => ref.current?.stop()
  }
}
