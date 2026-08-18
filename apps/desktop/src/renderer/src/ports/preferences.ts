// Port: nơi lưu tuỳ chọn người dùng + lịch sử cuộc họp giữa các lần mở app.

import type { SessionLayout, ThemeMode, UiLanguage } from '../domain/enums'
import type { GlossaryEntry } from '../domain/models'

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

// Lịch sử phiên KHÔNG nằm ở đây: nó do AI service lưu trong SQLite và đọc qua
// AiClient (GET /api/sessions) để dữ liệu còn sau khi tắt app.
