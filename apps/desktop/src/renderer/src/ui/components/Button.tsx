import type { JSX, ReactNode } from 'react'

export function Button({
  children,
  onClick,
  disabled
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}
