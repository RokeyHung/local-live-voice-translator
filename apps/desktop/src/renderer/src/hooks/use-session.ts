// Hook cầu nối: tạo SessionController (WS) theo vòng đời component.

import { useEffect, useRef } from 'react'
import { MicCapture } from '../adapters/mic-capture'
import { WsSessionChannel } from '../adapters/ws-session-channel'
import { SessionController } from '../application/session-controller'

export interface SessionActions {
  startSession: () => void
  ptt: (pressed: boolean) => void
  stopSession: () => void
}

export function useSession(): SessionActions {
  const ref = useRef<SessionController | null>(null)

  useEffect(() => {
    const controller = new SessionController(new WsSessionChannel(), new MicCapture())
    ref.current = controller
    controller.connect()
    return () => controller.dispose()
  }, [])

  return {
    startSession: () => ref.current?.startSession(),
    ptt: (pressed) => ref.current?.ptt(pressed),
    stopSession: () => ref.current?.stopSession()
  }
}
