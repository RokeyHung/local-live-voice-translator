// State giao diện + tuỳ chọn người dùng (Zustand), tự lưu qua PreferencesRepository.
// Không chứa dữ liệu phiên dịch — phần đó nằm ở session-store / meeting-store.

import { create } from 'zustand'
import { LocalPreferences } from '../adapters/local-preferences'
import type { ScreenId, ThemeMode, UiLanguage } from '../domain/enums'
import type { GlossaryEntry } from '../domain/models'
import type { PreferencesRepository } from '../ports/preferences'

const repo: PreferencesRepository = new LocalPreferences()
const stored = repo.load()

interface UiState {
  screen: ScreenId
  theme: ThemeMode
  uiLanguage: UiLanguage
  // SPEC 7.10/7.8 — duyệt bản dịch trước khi đọc ra micro ảo, và số giây tự gửi
  // nếu người dùng không bấm gì (0 = tắt tự gửi, chờ mãi).
  reviewBeforeSpeaking: boolean
  reviewCountdownSec: number
  glossary: GlossaryEntry[]
  inputDeviceId: string
  outputDeviceId: string

  setScreen: (screen: ScreenId) => void
  setTheme: (theme: ThemeMode) => void
  setUiLanguage: (uiLanguage: UiLanguage) => void
  setReviewBeforeSpeaking: (on: boolean) => void
  setReviewCountdownSec: (seconds: number) => void
  addGlossary: (source: string, target: string) => void
  removeGlossary: (id: string) => void
  setInputDeviceId: (id: string) => void
  setOutputDeviceId: (id: string) => void
}

export const useUiStore = create<UiState>((set, get) => {
  // Màn hình đang mở là state tạm; mọi tuỳ chọn còn lại đều được lưu.
  const persist = (): void => {
    const s = get()
    repo.save({
      theme: s.theme,
      uiLanguage: s.uiLanguage,
      reviewBeforeSpeaking: s.reviewBeforeSpeaking,
      reviewCountdownSec: s.reviewCountdownSec,
      glossary: s.glossary,
      inputDeviceId: s.inputDeviceId,
      outputDeviceId: s.outputDeviceId
    })
  }
  const update = (patch: Partial<UiState>): void => {
    set(patch as UiState)
    persist()
  }

  return {
    screen: 'session',
    theme: stored.theme ?? 'system',
    uiLanguage: stored.uiLanguage ?? 'vi',
    reviewBeforeSpeaking: stored.reviewBeforeSpeaking ?? false,
    reviewCountdownSec: stored.reviewCountdownSec ?? 5,
    glossary: stored.glossary ?? [],
    inputDeviceId: stored.inputDeviceId ?? '',
    outputDeviceId: stored.outputDeviceId ?? '',

    setScreen: (screen): void => set({ screen }),
    setTheme: (theme): void => update({ theme }),
    setUiLanguage: (uiLanguage): void => update({ uiLanguage }),
    setReviewBeforeSpeaking: (reviewBeforeSpeaking): void => update({ reviewBeforeSpeaking }),
    setReviewCountdownSec: (reviewCountdownSec): void => update({ reviewCountdownSec }),
    addGlossary: (source, target): void => {
      const src = source.trim()
      const dst = target.trim()
      if (!src || !dst) return
      update({ glossary: [...get().glossary, { id: `g${Date.now()}`, source: src, target: dst }] })
    },
    removeGlossary: (id): void => update({ glossary: get().glossary.filter((g) => g.id !== id) }),
    setInputDeviceId: (inputDeviceId): void => update({ inputDeviceId }),
    setOutputDeviceId: (outputDeviceId): void => update({ outputDeviceId })
  }
})
