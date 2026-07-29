// Hằng style dùng chung cho các màn (tách khỏi file component để Fast Refresh
// chỉ phải xử lý component).

import type { CSSProperties } from 'react'

export const PANEL: CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--line)',
  background: 'var(--panel)',
  backdropFilter: 'blur(20px)'
}

export const MONO: CSSProperties = { fontFamily: 'var(--font-mono)' }

export const LABEL: CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: 'var(--text4)',
  fontWeight: 700
}

export const inputStyle: CSSProperties = {
  width: '100%',
  height: 38,
  padding: '0 14px',
  borderRadius: 10,
  fontSize: 12.5,
  fontFamily: 'inherit',
  color: 'var(--text)',
  background: 'var(--inset)',
  border: '1px solid var(--line-strong)',
  outline: 'none'
}

// Mũi tên của <select> vẽ bằng data-URI để không phụ thuộc ảnh ngoài (CSP).
export const selectStyle: CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  height: 32,
  padding: '0 28px 0 10px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
  color: 'var(--text)',
  background:
    "var(--inset) url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%2394a3b8' stroke-width='2'><path d='M2 4l4 4 4-4'/></svg>\") no-repeat right 9px center",
  border: '1px solid var(--line-strong)',
  cursor: 'pointer',
  outline: 'none'
}

export const ghostButton: CSSProperties = {
  height: 34,
  padding: '0 14px',
  borderRadius: 9,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text2)',
  background: 'var(--line-soft)',
  border: '1px solid var(--line-strong)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7
}

export const primaryButton: CSSProperties = {
  height: 36,
  padding: '0 18px',
  borderRadius: 10,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
  color: '#04121a',
  background: 'linear-gradient(135deg,#22d3ee,#3b82f6)',
  border: 'none',
  boxShadow: '0 4px 14px rgba(34,211,238,.28)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8
}

export const dangerButton: CSSProperties = {
  height: 34,
  padding: '0 14px',
  borderRadius: 9,
  fontSize: 12,
  fontWeight: 600,
  color: '#f87171',
  background: 'rgba(239,68,68,.1)',
  border: '1px solid rgba(239,68,68,.22)',
  cursor: 'pointer'
}
