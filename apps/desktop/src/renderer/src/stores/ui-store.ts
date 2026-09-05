// State giao diện + tuỳ chọn người dùng (Zustand), tự lưu qua PreferencesRepository.
// Không chứa dữ liệu phiên dịch — phần đó nằm ở session-store / meeting-store.

import { create } from 'zustand'
import { LocalPreferences } from '../adapters/local-preferences'
import type { ScreenId, SessionLayout, ThemeMode, UiLanguage } from '../domain/enums'
import type { GlossaryEntry } from '../domain/models'
import type { PreferencesRepository } from '../ports/preferences'

const repo: PreferencesRepository = new LocalPreferences()
const stored = repo.load()

interface UiState {
  screen: ScreenId
  theme: ThemeMode
  uiLanguage: UiLanguage
  layout: SessionLayout
  glossary: GlossaryEntry[]
  inputDeviceId: string
  outputDeviceId: string
  virtualMicDeviceId: string

  setScreen: (screen: ScreenId) => void
  setTheme: (theme: ThemeMode) => void
  setUiLanguage: (uiLanguage: UiLanguage) => void
  setLayout: (layout: SessionLayout) => void
  addGlossary: (source: string, target: string) => void
  removeGlossary: (id: string) => void
  setInputDeviceId: (id: string) => void
  setOutputDeviceId: (id: string) => void
  setVirtualMicDeviceId: (id: string) => void
}

export const useUiStore = create<UiState>((set, get) => {
  // Màn hình đang mở là state tạm; mọi tuỳ chọn còn lại đều được lưu.
  const persist = (): void => {
    const s = get()
    repo.save({
      theme: s.theme,
      uiLanguage: s.uiLanguage,
      layout: s.layout,
      glossary: s.glossary,
      inputDeviceId: s.inputDeviceId,
      outputDeviceId: s.outputDeviceId,
      virtualMicDeviceId: s.virtualMicDeviceId
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
    layout: stored.layout ?? 'split',
    glossary: stored.glossary ?? [],
    inputDeviceId: stored.inputDeviceId ?? '',
    outputDeviceId: stored.outputDeviceId ?? '',
    virtualMicDeviceId: stored.virtualMicDeviceId ?? '',

    setScreen: (screen): void => set({ screen }),
    setTheme: (theme): void => update({ theme }),
    setUiLanguage: (uiLanguage): void => update({ uiLanguage }),
    setLayout: (layout): void => update({ layout }),
    addGlossary: (source, target): void => {
      const src = source.trim()
      const dst = target.trim()
      if (!src || !dst) return
      update({ glossary: [...get().glossary, { id: `g${Date.now()}`, source: src, target: dst }] })
    },
    removeGlossary: (id): void => update({ glossary: get().glossary.filter((g) => g.id !== id) }),
    setInputDeviceId: (inputDeviceId): void => update({ inputDeviceId }),
    setOutputDeviceId: (outputDeviceId): void => update({ outputDeviceId }),
    setVirtualMicDeviceId: (virtualMicDeviceId): void => update({ virtualMicDeviceId })
  }
})
