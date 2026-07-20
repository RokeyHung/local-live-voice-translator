import type { JSX } from 'react'

export function StatusDot({ ok }: { ok: boolean }): JSX.Element {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-rose-500'}`}
    />
  )
}
