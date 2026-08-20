// Nhật ký sự kiện ứng dụng (Zustand). Chỉ giữ trong bộ nhớ của tiến trình renderer:
// đóng app là mất, không ghi ra đĩa và không gửi đi đâu.
//
// Không lưu vào localStorage như các tuỳ chọn khác vì nhật ký chỉ có ích cho phiên
// làm việc đang chạy, mà nó lại chứa tên tệp và tên phiên người dùng vừa mở — giữ lại
// qua nhiều lần chạy là thu thập dữ liệu mà không ai yêu cầu.

import { create } from 'zustand'
import type { LogLevel, LogSource } from '../domain/enums'
import type { LogEntry } from '../domain/models'

// Vòng đệm: đủ để lần lại một phiên vừa chạy, không đủ để phình bộ nhớ.
const MAX_ENTRIES = 300

export type LogFilter = LogLevel | 'all'

interface LogState {
  entries: LogEntry[]
  filter: LogFilter

  append: (level: LogLevel, source: LogSource, message: string) => void
  setFilter: (filter: LogFilter) => void
  clear: () => void
}

let seq = 0

export const useLogStore = create<LogState>((set) => ({
  entries: [],
  filter: 'all',

  append: (level, source, message): void =>
    set((s) => ({
      entries: [
        ...s.entries.slice(-(MAX_ENTRIES - 1)),
        { id: `lg${++seq}`, at: Date.now(), level, source, message }
      ]
    })),

  setFilter: (filter): void => set({ filter }),
  clear: (): void => set({ entries: [] })
}))
