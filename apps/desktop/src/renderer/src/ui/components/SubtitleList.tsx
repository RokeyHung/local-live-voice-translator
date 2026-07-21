import { useEffect, useRef, type JSX } from 'react'
import { LANGUAGE_LABELS, type Utterance } from '../../domain/models'

function langLabel(u: Utterance): string {
  const src = u.sourceLanguage ? LANGUAGE_LABELS[u.sourceLanguage] : '?'
  const tgt = u.targetLanguage ? LANGUAGE_LABELS[u.targetLanguage] : '?'
  return `${src} → ${tgt}`
}

export function SubtitleList({
  utterances,
  large
}: {
  utterances: Utterance[]
  large?: boolean
}): JSX.Element {
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [utterances])

  if (utterances.length === 0) {
    return <p className="text-sm text-slate-500">— chưa có phụ đề —</p>
  }

  return (
    <ul className="space-y-3">
      {utterances.map((u) => (
        <li key={u.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">
            {langLabel(u)}
          </div>
          <p className={`text-slate-400 ${large ? 'text-base' : 'text-sm'}`}>
            {u.sourceText ?? '…'}
          </p>
          <p className={`font-medium text-emerald-300 ${large ? 'text-2xl' : 'text-base'}`}>
            {u.translatedText ?? '…'}
          </p>
        </li>
      ))}
      <div ref={endRef} />
    </ul>
  )
}
