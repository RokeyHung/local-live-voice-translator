// Màn Về ứng dụng: phiên bản (từ /health), công nghệ lõi, quyền riêng tư, liên kết.

import type { JSX } from 'react'
import { PLATFORM } from '../../application/config'
import { useHealth } from '../../hooks/use-health'
import { useDict } from '../../hooks/use-ui'
import { Icon, type IconName } from '../components/Icon'
import { ScreenHeader } from '../components/primitives'
import { MONO, PANEL } from '../styles'

const REPO = 'https://github.com/RokeyHung/local-live-voice-translator'

const STACK: { tag: string; color: string; name: string; note: string }[] = [
  { tag: 'ASR', color: '#22d3ee', name: 'whisper.cpp', note: 'Speech recognition' },
  { tag: 'MT', color: '#fb923c', name: 'NLLB-200 · transformers', note: 'Machine translation' },
  { tag: 'TTS', color: '#d946ef', name: 'sherpa-onnx · Piper VITS', note: 'Speech synthesis' },
  { tag: 'VAD', color: 'var(--ac-grn2)', name: 'Silero VAD', note: 'Voice activity detection' }
]

function LinkRow({
  icon,
  label,
  value,
  href
}: {
  icon: IconName
  label: string
  value?: string
  href?: string
}): JSX.Element {
  const content = (
    <>
      <Icon name={icon} size={16} />
      <span style={{ flex: 1 }}>{label}</span>
      {value && <span style={{ fontSize: 11, color: 'var(--text4)', ...MONO }}>{value}</span>}
    </>
  )
  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '13px 18px',
    borderBottom: '1px solid var(--line-soft)',
    fontSize: 12.5,
    color: 'var(--text2)'
  }
  return href ? (
    <a className="rowbtn" href={href} target="_blank" rel="noreferrer" style={style}>
      {content}
    </a>
  ) : (
    <div style={style}>{content}</div>
  )
}

export function AboutScreen(): JSX.Element {
  const L = useDict()
  const health = useHealth()

  return (
    <div
      style={{
        padding: '22px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 780
      }}
    >
      <ScreenHeader
        icon="info"
        title={L.about}
        subtitle={L.aboutSub}
        color="#818cf8"
        tint="rgba(129,140,248,.14)"
      />

      <div style={{ ...PANEL, padding: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg,#22d3ee,#3b82f6)',
            boxShadow: '0 10px 30px rgba(34,211,238,.35)',
            color: '#04121a'
          }}
        >
          <Icon name="mic" size={34} strokeWidth={2.4} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>{L.appName}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4, lineHeight: 1.45 }}>
            {L.aboutTagline}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: 11.5, ...MONO }}>
            <span style={{ color: 'var(--text3)' }}>
              {L.aboutVersion} <span style={{ color: 'var(--text)', fontWeight: 600 }}>1.0.0</span>
            </span>
            <span style={{ color: 'var(--text3)' }}>
              {L.aboutBuild}{' '}
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                {health.data?.version ?? '—'}
              </span>
            </span>
            <span style={{ color: 'var(--text3)' }}>
              {L.aboutPlatform}{' '}
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                {health.data?.platform ?? PLATFORM}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ ...PANEL, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <span style={{ color: '#a855f7', display: 'flex' }}>
              <Icon name="box" size={16} />
            </span>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{L.aboutStackT}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {STACK.map((item) => (
              <div key={item.tag} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span
                  style={{
                    width: 42,
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    color: item.color
                  }}
                >
                  {item.tag}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, ...MONO }}>{item.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text4)' }}>{item.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            borderRadius: 16,
            border: '1px solid rgba(34,197,94,.25)',
            background: 'rgba(34,197,94,.06)',
            backdropFilter: 'blur(20px)',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
            <span style={{ color: '#22c55e', display: 'flex' }}>
              <Icon name="shield" size={16} />
            </span>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ac-grn)' }}>
              {L.aboutPrivacyT}
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55 }}>
            {L.aboutPrivacyB}
          </div>
        </div>
      </div>

      <div style={{ ...PANEL, overflow: 'hidden' }}>
        <div
          style={{
            padding: '13px 18px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--surface)',
            fontSize: 12.5,
            fontWeight: 700
          }}
        >
          {L.aboutLinksT}
        </div>
        <LinkRow icon="github" label={L.aboutRepo} value="github.com/RokeyHung" href={REPO} />
        <LinkRow icon="book" label={L.aboutDocs} href={`${REPO}/tree/main/docs`} />
        <LinkRow icon="file" label={L.aboutLicense} value="MIT" />
        <LinkRow icon="pencil" label={L.aboutInspired} value="homelab-00" />
      </div>
    </div>
  )
}
