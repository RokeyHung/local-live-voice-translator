// Hook cầu nối cho phần trình bày: từ điển nhãn, chủ đề đã giải quyết, phần cứng,
// danh sách thiết bị và mức tín hiệu mic.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { listInputDevices, listOutputDevices, type AudioDevice } from '../adapters/audio-devices'
import { probeCompute } from '../adapters/compute-probe'
import { LevelMeter } from '../adapters/level-meter'
import { dict, type Dict } from '../application/i18n'
import type { ComputeInfo } from '../domain/models'
import { useUiStore } from '../stores/ui-store'

export function useDict(): Dict {
  const lang = useUiStore((s) => s.uiLanguage)
  return useMemo(() => dict(lang), [lang])
}

// 'system' bám theo prefers-color-scheme và cập nhật khi người dùng đổi ở OS.
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useUiStore((s) => s.theme)
  const [systemLight, setSystemLight] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false
  )

  useEffect(() => {
    const mql = window.matchMedia?.('(prefers-color-scheme: light)')
    if (!mql) return
    const onChange = (e: MediaQueryListEvent): void => setSystemLight(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  if (theme === 'system') return systemLight ? 'light' : 'dark'
  return theme
}

/**
 * Giữ một vùng cuộn bám đáy khi `signature` đổi (có câu mới, hoặc bản nháp ASR
 * dài thêm). Người dùng cuộn lên đọc lại thì nhả ra, cuộn về sát đáy thì bám lại
 * — nếu không, phụ đề mới sẽ giật màn hình ngay lúc đang đọc câu cũ.
 */
export function useStickyBottom<T extends HTMLElement>(signature: string): RefObject<T | null> {
  const ref = useRef<T>(null)
  const stuck = useRef(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = (): void => {
      stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // useLayoutEffect: nhảy xuống đáy trước khi trình duyệt vẽ, tránh nháy một khung.
  useLayoutEffect(() => {
    const el = ref.current
    if (el && stuck.current) el.scrollTop = el.scrollHeight
  }, [signature])

  return ref
}

export function useCompute(): ComputeInfo | null {
  const [info, setInfo] = useState<ComputeInfo | null>(null)
  useEffect(() => {
    // Chỉ đọc navigator/WebGL nên gần như tức thời; giữ async để không chặn render đầu.
    const id = window.setTimeout(() => setInfo(probeCompute()), 0)
    return () => window.clearTimeout(id)
  }, [])
  return info
}

export interface DeviceLists {
  inputs: AudioDevice[]
  outputs: AudioDevice[]
}

export function useAudioDevices(): DeviceLists {
  const [devices, setDevices] = useState<DeviceLists>({ inputs: [], outputs: [] })

  useEffect(() => {
    let alive = true
    const load = async (): Promise<void> => {
      const [inputs, outputs] = await Promise.all([listInputDevices(), listOutputDevices()])
      if (alive) setDevices({ inputs, outputs })
    }
    void load()
    navigator.mediaDevices.addEventListener('devicechange', load)
    return () => {
      alive = false
      navigator.mediaDevices.removeEventListener('devicechange', load)
    }
  }, [])

  return devices
}

// Mở stream đo mức riêng (chỉ dùng ở màn Thiết lập khi chưa có phiên chạy).
export function useMicLevel(deviceId: string, enabled: boolean): number {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const meter = new LevelMeter()
    let alive = true
    void meter
      .start(deviceId, (value) => {
        if (alive) setLevel(value)
      })
      .catch(() => undefined)
    return () => {
      alive = false
      meter.stop()
    }
  }, [deviceId, enabled])

  // Khi tắt, trả 0 ngay thay vì giữ lại giá trị đo cuối cùng.
  return enabled ? level : 0
}
