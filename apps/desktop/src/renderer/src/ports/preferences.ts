// Port: nơi lưu tuỳ chọn người dùng + lịch sử cuộc họp giữa các lần mở app.

import type { ThemeMode, UiLanguage } from '../domain/enums'
import type { GlossaryEntry } from '../domain/models'

export interface StoredPreferences {
  theme: ThemeMode
  uiLanguage: UiLanguage
  reviewBeforeSpeaking: boolean
  reviewCountdownSec: number
  glossary: GlossaryEntry[]
  inputDeviceId: string
  outputDeviceId: string
}

// Access token HuggingFace KHÔNG nằm ở đây. Nó là bí mật duy nhất của ứng dụng, mà
// localStorage thì lưu văn bản thường và mọi script trong renderer đều đọc được.
// Token do AI service giữ (`~/.llvt/settings.json`, quyền 0600) và đọc/ghi qua
// `PUT /api/config`; renderer chỉ thấy cờ "đã có" cùng một đoạn che.

export interface PreferencesRepository {
  load(): Partial<StoredPreferences>
  save(prefs: StoredPreferences): void
}

// Lịch sử phiên KHÔNG nằm ở đây: nó do AI service lưu trong SQLite và đọc qua
// AiClient (GET /api/sessions) để dữ liệu còn sau khi tắt app.
