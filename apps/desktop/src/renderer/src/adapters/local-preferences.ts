// Adapter: lưu tuỳ chọn người dùng vào localStorage của renderer.
// Toàn bộ dữ liệu nằm trên máy — không đồng bộ ra ngoài.

import type { PreferencesRepository, StoredPreferences } from '../ports/preferences'

const PREFS_KEY = 'llvt.prefs.v1'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as T
    return parsed ?? fallback
  } catch {
    // Dữ liệu hỏng hoặc localStorage bị chặn — dùng mặc định.
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Hết quota hoặc bị chặn — không chặn luồng UI.
  }
}

export class LocalPreferences implements PreferencesRepository {
  load(): Partial<StoredPreferences> {
    const prefs = read<Partial<StoredPreferences> & { hfToken?: string }>(PREFS_KEY, {})
    if ('hfToken' in prefs) {
      // Bản trước lưu access token HuggingFace ở đây. localStorage là văn bản thường
      // và mọi script trong renderer đọc được, nên token đã chuyển hẳn sang AI service
      // (`~/.llvt/settings.json`, quyền 0600). Xoá ngay khi gặp — người dùng đã gõ
      // token vào bản cũ thì nó không được nằm lại đây sau khi cập nhật.
      delete prefs.hfToken
      write(PREFS_KEY, prefs)
    }
    return prefs
  }

  save(prefs: StoredPreferences): void {
    write(PREFS_KEY, prefs)
  }
}
