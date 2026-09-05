// Khối dựng hình dùng lại giữa các màn: panel kính mờ, tiêu đề màn hình, badge,
// nút phân đoạn, thanh mức, ô trống, chấm trạng thái.
//
// Màu của Badge/Dot/Notice do nơi gọi truyền vào (màu theo khâu pipeline, theo
// bên phát, theo mức độ cảnh báo) nên phần màu vẫn đi qua `style`; còn lại là
// class Tailwind.

import type { CSSProperties, JSX, ReactNode } from 'react'
import { GHOST_BUTTON } from '../styles'
import { Icon, type IconName } from './Icon'

export function Panel({
  children,
  className = '',
  style
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}): JSX.Element {
  return (
    <div className={`panel ${className}`} style={style}>
      {children}
    </div>
  )
}

export function ScreenHeader({
  icon,
  title,
  subtitle,
  color,
  tint,
  right
}: {
  icon: IconName
  title: string
  subtitle?: string
  color: string
  tint: string
  right?: ReactNode
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.75">
          <span
            className="inline-flex size-8.5 shrink-0 items-center justify-center rounded-md"
            style={{ background: tint, color }}
          >
            <Icon name={icon} size={18} />
          </span>
          <div className="text-2xl font-extrabold tracking-[-0.3px]">{title}</div>
        </div>
        {subtitle && <div className="mt-1.25 text-base text-fg-3">{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}

export function Dot({
  color,
  size = 7,
  glow = true,
  pulse = false
}: {
  color: string
  size?: number
  glow?: boolean
  pulse?: boolean
}): JSX.Element {
  const core: CSSProperties = {
    width: size,
    height: size,
    background: color,
    ...(glow ? { boxShadow: `0 0 ${size}px ${color}` } : {})
  }

  if (!pulse) return <span className="shrink-0 rounded-full" style={core} />

  return (
    <span className="relative flex shrink-0" style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 rounded-full opacity-70 motion-safe:animate-[ping_1.8s_cubic-bezier(0,0,.2,1)_infinite]"
        style={{ background: color }}
      />
      <span className="relative rounded-full" style={core} />
    </span>
  )
}

export function Badge({ color, children }: { color: string; children: ReactNode }): JSX.Element {
  return (
    <span
      className="rounded-full border px-1.75 py-0.5 text-2xs font-bold tracking-[0.4px] whitespace-nowrap uppercase"
      style={{ color, background: `${color}1f`, borderColor: `${color}44` }}
    >
      {children}
    </span>
  )
}

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'sm'
}: {
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  size?: 'sm' | 'lg'
}): JSX.Element {
  const large = size === 'lg'
  return (
    // `w-fit`: khung bo phải ôm sát các nút. Là thẻ div nên mặc định nó giãn hết bề
    // ngang của cha (hoặc bị stretch trong flex-column), để lại một mảng nền thừa
    // bên phải nút cuối cùng.
    <div className="flex w-fit gap-1 rounded-md border border-line bg-inset-2 p-0.75">
      {options.map((option) => {
        const on = option.value === value
        const active = large
          ? 'bg-linear-[135deg,#22d3ee,#3b82f6] text-[#04121a]'
          : 'bg-line-strong text-fg'
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={[
              'cursor-pointer rounded-[7px] border-none transition-all',
              large ? 'h-9.5 px-4.5 text-md font-bold' : 'h-7 px-3 text-sm font-semibold',
              on ? active : 'bg-transparent text-fg-3 hover:text-fg-2'
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Meter({
  value,
  color,
  to,
  height = 8
}: {
  value: number // 0..1
  color: string
  // Màu cuối của dải. Bỏ trống thì nhạt dần chính `color` — thanh tiến trình nạp
  // model là chỗ duy nhất thiết kế đổi hẳn sang màu khác (tím → chàm).
  to?: string
  height?: number
}): JSX.Element {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <div
      className="flex-1 overflow-hidden rounded-full bg-line-soft"
      style={{ height }}
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-100 ease-linear"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg,${color},${to ?? `${color}aa`})`
        }}
      />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  color = 'var(--text5)',
  minHeight = 260
}: {
  icon: IconName
  title: string
  body?: string
  color?: string
  minHeight?: number
}): JSX.Element {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3.5 px-6 py-12 text-fg-5"
      style={{ minHeight }}
    >
      <div
        className="flex size-15 items-center justify-center rounded-3xl bg-surface"
        style={{ color }}
      >
        <Icon name={icon} size={28} strokeWidth={1.5} />
      </div>
      <div className="max-w-95 text-center">
        <div className="text-[14.5px] font-bold text-fg-2">{title}</div>
        {body && <div className="mt-1.5 text-base leading-relaxed text-fg-4">{body}</div>}
      </div>
    </div>
  )
}

const NOTICE_TONES = {
  info: { color: '#22d3ee', border: 'rgba(34,211,238,.3)', bg: 'rgba(34,211,238,.07)' },
  warn: { color: '#fb923c', border: 'rgba(251,146,60,.3)', bg: 'rgba(251,146,60,.08)' },
  error: { color: '#f87171', border: 'rgba(239,68,68,.3)', bg: 'rgba(239,68,68,.08)' },
  ok: { color: '#22c55e', border: 'rgba(34,197,94,.3)', bg: 'rgba(34,197,94,.07)' }
} as const

// Dải thông báo (thông tin / cảnh báo / lỗi) dùng ở nhiều màn.
export function Notice({
  tone,
  icon,
  title,
  body,
  right
}: {
  tone: keyof typeof NOTICE_TONES
  icon: IconName
  title: string
  body?: string
  right?: ReactNode
}): JSX.Element {
  const palette = NOTICE_TONES[tone]
  const spinning = icon === 'spinner'

  return (
    <div
      className="flex items-center gap-3.25 rounded-xl border px-4 py-3.25"
      style={{ borderColor: palette.border, background: palette.bg }}
    >
      <span className="flex" style={{ color: palette.color }}>
        <Icon name={icon} size={19} spin={spinning} strokeWidth={spinning ? 2.6 : 2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-base font-bold" style={{ color: palette.color }}>
          {title}
        </div>
        {body && <div className="mt-0.5 text-sm leading-snug text-fg-3">{body}</div>}
      </div>
      {right}
    </div>
  )
}

// Nút cho tính năng chưa có backend: vẫn hiện đúng vị trí thiết kế nhưng mờ và
// không bấm được, kèm tooltip giải thích.
export function DisabledButton({
  label,
  hint,
  icon,
  className = ''
}: {
  label: string
  hint: string
  icon?: IconName
  className?: string
}): JSX.Element {
  return (
    <button disabled title={hint} className={`${GHOST_BUTTON} opacity-45 ${className}`}>
      {icon && <Icon name={icon} size={13} />}
      {label}
    </button>
  )
}
