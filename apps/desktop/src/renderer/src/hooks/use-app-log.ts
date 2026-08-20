// Ghi vào nhật ký những sự kiện ở mức toàn ứng dụng: khởi động, lỗi không ai bắt,
// và AI service lên/xuống. Các sự kiện khác được ghi ngay tại nơi chúng xảy ra
// (SessionController, hook nạp model, hook nhập tệp).

import { useEffect, useRef } from 'react'
import { format } from '../application/i18n'
import { errorText, logError, logInfo, logWarn } from '../application/logger'
import { useHealth } from './use-health'

export function useAppEventLog(): void {
  const booted = useRef(false)
  useEffect(() => {
    // Ref giữ nguyên qua lần chạy đôi của StrictMode nên dòng này chỉ ghi một lần.
    if (booted.current) return
    booted.current = true
    logInfo('app', (L) => L.logAppStarted)
  }, [])

  useEffect(() => {
    const onError = (e: ErrorEvent): void =>
      logError('system', (L) => format(L.logUnhandled, { msg: e.message }))
    const onRejection = (e: PromiseRejectionEvent): void =>
      logError('system', (L) => format(L.logUnhandled, { msg: errorText(e.reason) }))

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  // /health được hỏi lại mỗi 5 giây; chỉ ghi lúc ĐỔI trạng thái, không thì nhật ký
  // ngập một dòng mỗi nhịp và không còn đọc được nữa.
  const health = useHealth()
  const up = health.isSuccess
  const previous = useRef<boolean | null>(null)
  useEffect(() => {
    // Lần hỏi đầu tiên chưa trả lời thì chưa có gì để nói.
    if (health.isPending && previous.current === null) return
    if (previous.current === up) return
    previous.current = up
    if (up) logInfo('service', (L) => L.logServiceUp)
    else logWarn('service', (L) => L.logServiceDown)
  }, [up, health.isPending])
}
