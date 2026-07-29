// Thanh sóng hiển thị mức tín hiệu của một nguồn audio.
//
// Chiều cao mỗi cột lấy từ mức RMS thật (không phải animation trang trí): cột giữa
// cao nhất, hai bên thấp dần, cộng một chút nhiễu ổn định theo chỉ số cột để dải
// sóng không phẳng lì. Không có tín hiệu thì mọi cột về mức nền.
//
// Màu và chiều cao đổi theo từng khung audio nên phần đó buộc phải là inline
// style — Tailwind không sinh được class cho giá trị tính lúc chạy.

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
      className="flex flex-1 flex-col gap-2 rounded-2xl border px-4 py-3.25 backdrop-blur-xl"
      style={{
        borderColor: `${color}33`,
        background: `linear-gradient(to bottom right,${color}0d,var(--inset))`
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-2 text-xs font-bold tracking-[0.5px] uppercase"
          style={{ color }}
        >
          <span
            className="size-1.75 rounded-full"
            style={{ background: color, boxShadow: `0 0 7px ${color}` }}
          />
          {label}
        </div>
        <span className="font-mono text-[10px] text-fg-3">
          {note ?? (db == null ? '-∞ dB' : `${db} dB`)}
        </span>
      </div>
      <div className="flex h-9.5 items-end gap-0.75">
        {Array.from({ length: BARS }, (_, i) => {
          const center = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2)
          const height = 12 + norm * (18 + center * 70) * jitter(i)
          return (
            <span
              key={i}
              className="min-h-0.75 flex-1 rounded-[2px] transition-[height] duration-75 ease-linear"
              style={{
                height: `${Math.min(100, height)}%`,
                background:
                  norm > 0.02 ? `linear-gradient(to top,${color},${color}66)` : `${color}2e`
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
