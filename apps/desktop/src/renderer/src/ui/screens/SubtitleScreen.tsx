import type { JSX } from 'react'
import { useSessionStore } from '../../stores/session-store'
import { SubtitleList } from '../components/SubtitleList'

export function SubtitleScreen(): JSX.Element {
  const utterances = useSessionStore((s) => s.utterances)
  const clearTranscript = useSessionStore((s) => s.clearTranscript)

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">Phụ đề song ngữ</h2>
        <button
          className="text-xs text-slate-400 hover:text-slate-200"
          onClick={() => clearTranscript()}
        >
          Xóa
        </button>
      </div>
      <div className="max-h-[70vh] overflow-auto pr-1">
        <SubtitleList utterances={utterances} large />
      </div>
    </section>
  )
}
