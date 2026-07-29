// Khối dựng hình dùng lại giữa các màn: panel kính mờ, tiêu đề màn hình, badge,
// nút phân đoạn, thanh mức, ô trống, chấm trạng thái.

import type { CSSProperties, JSX, ReactNode } from 'react'
import { ghostButton, PANEL } from '../styles'
import { Icon, type IconName } from './Icon'

export function Panel({
  children,
  style,
  className
}: {
  children: ReactNode
  style?: CSSProperties
  className?: string
}): JSX.Element {
  return (
    <div className={className} style={{ ...PANEL, ...style }}>
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
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap'
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span
            style={{
              display: 'inline-flex',
              width: 34,
              height: 34,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background: tint,
              color
            }}
          >
            <Icon name={icon} size={18} />
          </span>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>{title}</div>
        </div>
        {subtitle && (
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 5 }}>{subtitle}</div>
        )}
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
  if (!pulse) {
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
          ...(glow ? { boxShadow: `0 0 ${size}px ${color}` } : {})
        }}
      />
    )
  }
  return (
    <span
      style={{ position: 'relative', display: 'flex', width: size, height: size, flexShrink: 0 }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: color,
          animation: 'ping 1.8s cubic-bezier(0,0,.2,1) infinite',
          opacity: 0.7
        }}
      />
      <span
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          ...(glow ? { boxShadow: `0 0 ${size}px ${color}` } : {})
        }}
      />
    </span>
  )
}

export function Badge({ color, children }: { color: string; children: ReactNode }): JSX.Element {
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        padding: '2px 7px',
        borderRadius: 9999,
        color,
        background: `${color}1f`,
        border: `1px solid ${color}44`,
        whiteSpace: 'nowrap'
      }}
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
  const height = size === 'lg' ? 38 : 28
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: 3,
        borderRadius: 10,
        background: 'var(--inset2)',
        border: '1px solid var(--line)'
      }}
    >
      {options.map((option) => {
        const on = option.value === value
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            style={{
              padding: size === 'lg' ? '0 18px' : '0 12px',
              height,
              borderRadius: 7,
              border: 'none',
              fontSize: size === 'lg' ? 13 : 11.5,
              fontWeight: size === 'lg' ? 700 : 600,
              cursor: 'pointer',
              transition: 'all .15s',
              background: on
                ? size === 'lg'
                  ? 'linear-gradient(135deg,#22d3ee,#3b82f6)'
                  : 'var(--line-strong)'
                : 'transparent',
              color: on ? (size === 'lg' ? '#04121a' : 'var(--text)') : 'var(--text3)'
            }}
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
  height = 8
}: {
  value: number // 0..1
  color: string
  height?: number
}): JSX.Element {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <div
      style={{
        flex: 1,
        height,
        borderRadius: 9999,
        background: 'var(--line-soft)',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 9999,
          background: `linear-gradient(90deg,${color},${color}aa)`,
          transition: 'width .12s linear'
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
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        color: 'var(--text5)',
        padding: '48px 24px',
        minHeight
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface)',
          color
        }}
      >
        <Icon name={icon} size={28} strokeWidth={1.5} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text2)' }}>{title}</div>
        {body && (
          <div style={{ fontSize: 12.5, color: 'var(--text4)', marginTop: 6, lineHeight: 1.55 }}>
            {body}
          </div>
        )}
      </div>
    </div>
  )
}

// Dải thông báo (thông tin / cảnh báo / lỗi) dùng ở nhiều màn.
export function Notice({
  tone,
  icon,
  title,
  body,
  right
}: {
  tone: 'info' | 'warn' | 'error' | 'ok'
  icon: IconName
  title: string
  body?: string
  right?: ReactNode
}): JSX.Element {
  const palette = {
    info: { color: '#22d3ee', border: 'rgba(34,211,238,.3)', bg: 'rgba(34,211,238,.07)' },
    warn: { color: '#fb923c', border: 'rgba(251,146,60,.3)', bg: 'rgba(251,146,60,.08)' },
    error: { color: '#f87171', border: 'rgba(239,68,68,.3)', bg: 'rgba(239,68,68,.08)' },
    ok: { color: '#22c55e', border: 'rgba(34,197,94,.3)', bg: 'rgba(34,197,94,.07)' }
  }[tone]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '13px 16px',
        borderRadius: 14,
        border: `1px solid ${palette.border}`,
        background: palette.bg
      }}
    >
      <span style={{ display: 'flex', color: palette.color }}>
        <Icon
          name={icon}
          size={19}
          spin={icon === 'spinner'}
          strokeWidth={icon === 'spinner' ? 2.6 : 2}
        />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: palette.color }}>{title}</div>
        {body && (
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2, lineHeight: 1.45 }}>
            {body}
          </div>
        )}
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
  style
}: {
  label: string
  hint: string
  icon?: IconName
  style?: CSSProperties
}): JSX.Element {
  return (
    <button
      disabled
      title={hint}
      style={{ ...ghostButton, opacity: 0.45, cursor: 'not-allowed', ...style }}
    >
      {icon && <Icon name={icon} size={13} />}
      {label}
    </button>
  )
}
