// Thanh sóng hiển thị mức tín hiệu của một nguồn audio.
//
// Chiều cao mỗi cột lấy từ mức RMS thật (không phải animation trang trí): cột giữa
// cao nhất, hai bên thấp dần, cộng một chút nhiễu ổn định theo chỉ số cột để dải
// sóng không phẳng lì. Không có tín hiệu thì mọi cột về mức nền.

import type { JSX } from 'react'
import { rmsToDb } from '../../adapters/level-meter'

const BARS = 30

// Nhiễu tất định theo chỉ số cột — cùng một mức thì hình dạng sóng ổn định.
function jitter(index: number): number {
  return 0.72 + 0.28 * Math.abs(Math.sin(index * 1.7))
}

export function Visualizer({
  label,
  level,
  color,
  active,
  note
}: {
  label: string
  level: number // RMS 0..1
  color: string
  active: boolean
  note?: string
}): JSX.Element {
  const db = active ? rmsToDb(level) : null
  // RMS giọng nói thường rất nhỏ (0.01–0.2) → nén log cho dễ nhìn.
  const norm = active ? Math.min(1, Math.max(0, (rmsToDb(level) ?? -60) + 60) / 55) : 0

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '13px 16px',
        borderRadius: 16,
        border: `1px solid ${color}33`,
        background: `linear-gradient(to bottom right,${color}0d,var(--inset))`,
        backdropFilter: 'blur(20px)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: color,
              boxShadow: `0 0 7px ${color}`
            }}
          />
          {label}
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' }}>
          {note ?? (db == null ? '-∞ dB' : `${db} dB`)}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 38 }}>
        {Array.from({ length: BARS }, (_, i) => {
          const center = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2)
          const height = 12 + norm * (18 + center * 70) * jitter(i)
          return (
            <span
              key={i}
              style={{
                flex: 1,
                height: `${Math.min(100, height)}%`,
                minHeight: 3,
                borderRadius: 2,
                background:
                  norm > 0.02 ? `linear-gradient(to top,${color},${color}66)` : `${color}2e`,
                transition: 'height .08s linear'
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
