// Lịch sử cuộc họp: mỗi lần nhấn Bắt đầu mở một cuộc họp, mỗi câu dịch xong ghi
// thêm một dòng. Lưu cục bộ (localStorage) — repository SQLite bên ai-service chỉ
// giữ SessionSummary, chưa lưu nội dung câu.

import { create } from 'zustand'
import { LocalMeetings } from '../adapters/local-preferences'
import type { Meeting, MeetingRow } from '../domain/models'
import type { MeetingRepository } from '../ports/preferences'

const repo: MeetingRepository = new LocalMeetings()

const MAX_MEETINGS = 50

function defaultTitle(prefix: string, at: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${prefix}_${p(at.getDate())}_${p(at.getMonth() + 1)}_${at.getFullYear()}_${p(at.getHours())}${p(at.getMinutes())}`
}

interface MeetingState {
  meetings: Meeting[]
  currentId: string | null
  selectedId: string | null
  query: string
  editingId: string | null
  // Cuộc họp còn dở từ lần chạy trước (có câu nhưng chưa được đóng vì app tắt đột ngột).
  recoverableId: string | null

  startMeeting: (titlePrefix: string) => void
  resolveRecovery: (review: boolean) => void
  endMeeting: () => void
  appendRow: (row: MeetingRow) => void
  select: (id: string) => void
  rename: (id: string, title: string) => void
  remove: (id: string) => void
  clearAll: () => void
  setQuery: (query: string) => void
  setEditing: (id: string | null) => void
}

export const useMeetingStore = create<MeetingState>((set, get) => {
  const initial = repo.load()
  const persist = (meetings: Meeting[]): void => repo.save(meetings)

  return {
    meetings: initial,
    currentId: null,
    selectedId: initial[0]?.id ?? null,
    query: '',
    editingId: null,
    recoverableId: initial.find((m) => !m.endedAtMs && m.rows.length > 0)?.id ?? null,

    // Đóng cuộc họp còn dở lại (đã hỏi rồi thì thôi không hỏi nữa); `review` thì
    // chọn luôn cuộc họp đó để người dùng xem ở màn Lịch sử.
    resolveRecovery: (review): void => {
      const id = get().recoverableId
      if (!id) return
      const next = get().meetings.map((m) =>
        m.id === id ? { ...m, endedAtMs: m.rows[m.rows.length - 1]?.atMs ?? Date.now() } : m
      )
      persist(next)
      set((s) => ({
        meetings: next,
        recoverableId: null,
        selectedId: review ? id : s.selectedId
      }))
    },

    startMeeting: (titlePrefix): void => {
      const now = new Date()
      const meeting: Meeting = {
        id: `mtg-${now.getTime()}`,
        title: defaultTitle(titlePrefix, now),
        startedAtMs: now.getTime(),
        rows: []
      }
      const meetings = [meeting, ...get().meetings].slice(0, MAX_MEETINGS)
      persist(meetings)
      set({ meetings, currentId: meeting.id, selectedId: meeting.id })
    },

    endMeeting: (): void => {
      const { currentId, meetings } = get()
      if (!currentId) return
      // Cuộc họp không có câu nào (bắt đầu rồi dừng ngay) thì không giữ lại.
      const current = meetings.find((m) => m.id === currentId)
      const next =
        current && current.rows.length === 0
          ? meetings.filter((m) => m.id !== currentId)
          : meetings.map((m) => (m.id === currentId ? { ...m, endedAtMs: Date.now() } : m))
      persist(next)
      set({
        meetings: next,
        currentId: null,
        selectedId: next.some((m) => m.id === get().selectedId)
          ? get().selectedId
          : (next[0]?.id ?? null)
      })
    },

    appendRow: (row): void => {
      const { currentId, meetings } = get()
      if (!currentId) return
      const next = meetings.map((m) => (m.id === currentId ? { ...m, rows: [...m.rows, row] } : m))
      persist(next)
      set({ meetings: next })
    },

    select: (selectedId): void => set({ selectedId }),

    rename: (id, title): void => {
      const clean = title.trim()
      if (!clean) return set({ editingId: null })
      const next = get().meetings.map((m) => (m.id === id ? { ...m, title: clean } : m))
      persist(next)
      set({ meetings: next, editingId: null })
    },

    remove: (id): void => {
      const next = get().meetings.filter((m) => m.id !== id)
      persist(next)
      set((s) => ({
        meetings: next,
        selectedId: s.selectedId === id ? (next[0]?.id ?? null) : s.selectedId,
        currentId: s.currentId === id ? null : s.currentId,
        recoverableId: s.recoverableId === id ? null : s.recoverableId
      }))
    },

    clearAll: (): void => {
      persist([])
      set({ meetings: [], selectedId: null, currentId: null, recoverableId: null })
    },

    setQuery: (query): void => set({ query }),
    setEditing: (editingId): void => set({ editingId })
  }
})
