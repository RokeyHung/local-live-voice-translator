// Adapter: lưu tuỳ chọn + lịch sử cuộc họp vào localStorage của renderer.
// Toàn bộ dữ liệu nằm trên máy — không đồng bộ ra ngoài.

import type { Meeting } from '../domain/models'
import type {
  MeetingRepository,
  PreferencesRepository,
  StoredPreferences
} from '../ports/preferences'

const PREFS_KEY = 'llvt.prefs.v1'
const MEETINGS_KEY = 'llvt.meetings.v1'

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
    return read<Partial<StoredPreferences>>(PREFS_KEY, {})
  }

  save(prefs: StoredPreferences): void {
    write(PREFS_KEY, prefs)
  }
}

export class LocalMeetings implements MeetingRepository {
  load(): Meeting[] {
    const list = read<Meeting[]>(MEETINGS_KEY, [])
    return Array.isArray(list) ? list : []
  }

  save(meetings: Meeting[]): void {
    write(MEETINGS_KEY, meetings)
  }
}
