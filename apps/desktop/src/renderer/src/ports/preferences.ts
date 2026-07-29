// Port: nơi lưu tuỳ chọn người dùng + lịch sử cuộc họp giữa các lần mở app.

import type { SessionLayout, ThemeMode, UiLanguage } from '../domain/enums'
import type { GlossaryEntry, Meeting } from '../domain/models'

export interface StoredPreferences {
  theme: ThemeMode
  uiLanguage: UiLanguage
  layout: SessionLayout
  hfToken: string
  glossary: GlossaryEntry[]
  inputDeviceId: string
  outputDeviceId: string
  virtualMicDeviceId: string
}

export interface PreferencesRepository {
  load(): Partial<StoredPreferences>
  save(prefs: StoredPreferences): void
}

// Lịch sử cuộc họp lưu tách khỏi tuỳ chọn (dữ liệu lớn hơn, vòng đời khác).
export interface MeetingRepository {
  load(): Meeting[]
  save(meetings: Meeting[]): void
}
