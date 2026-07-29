// Màn Cài đặt: chủ đề, ngôn ngữ giao diện, token Hugging Face và glossary.
// Toàn bộ lưu trong localStorage của máy.

import { useState, type JSX } from 'react'
import type { ThemeMode } from '../../domain/enums'
import { useDict } from '../../hooks/use-ui'
import { useUiStore } from '../../stores/ui-store'
import { Icon, type IconName } from '../components/Icon'
import { ScreenHeader, Segmented } from '../components/primitives'
import { inputStyle, MONO, PANEL, primaryButton } from '../styles'

function Section({
  icon,
  color,
  title,
  desc,
  right,
  children
}: {
  icon: IconName
  color: string
  title: string
  desc: string
  right?: JSX.Element
  children: JSX.Element
}): JSX.Element {
  return (
    <div style={{ ...PANEL, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ color, display: 'flex' }}>
          <Icon name={icon} size={16} />
        </span>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{title}</div>
        {right}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>{desc}</div>
      {children}
    </div>
  )
}

export function SettingsScreen(): JSX.Element {
  const L = useDict()
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const uiLanguage = useUiStore((s) => s.uiLanguage)
  const setUiLanguage = useUiStore((s) => s.setUiLanguage)
  const hfToken = useUiStore((s) => s.hfToken)
  const setHfToken = useUiStore((s) => s.setHfToken)
  const glossary = useUiStore((s) => s.glossary)
  const addGlossary = useUiStore((s) => s.addGlossary)
  const removeGlossary = useUiStore((s) => s.removeGlossary)

  const [src, setSrc] = useState('')
  const [dst, setDst] = useState('')

  const submitTerm = (): void => {
    addGlossary(src, dst)
    setSrc('')
    setDst('')
  }

  const themeCards: { mode: ThemeMode; icon: IconName; label: string; sub: string }[] = [
    { mode: 'system', icon: 'monitor', label: L.tSystem, sub: L.tSystemSub },
    { mode: 'light', icon: 'sun', label: L.tLight, sub: L.tLightSub },
    { mode: 'dark', icon: 'moon', label: L.tDark, sub: L.tDarkSub }
  ]

  return (
    <div
      style={{
        padding: '22px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 760
      }}
    >
      <ScreenHeader
        icon="gear"
        title={L.settings}
        subtitle={L.settingsSub}
        color="#38bdf8"
        tint="rgba(56,189,248,.12)"
      />

      <Section icon="sun" color="var(--ac-sky)" title={L.appearance} desc={L.themeDesc}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {themeCards.map((card) => {
            const on = theme === card.mode
            return (
              <button
                key={card.mode}
                onClick={() => setTheme(card.mode)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  padding: '16px 12px',
                  borderRadius: 13,
                  cursor: 'pointer',
                  transition: 'all .16s',
                  border: `1px solid ${on ? 'rgba(125,211,252,.5)' : 'var(--line)'}`,
                  background: on ? 'rgba(125,211,252,.1)' : 'var(--surface)',
                  color: on ? 'var(--ac-sky2)' : 'var(--text2)',
                  boxShadow: on ? '0 0 16px rgba(125,211,252,.14)' : 'none'
                }}
              >
                <span style={{ display: 'flex', color: on ? 'var(--ac-sky)' : 'var(--text3)' }}>
                  <Icon name={card.icon} size={20} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, marginTop: 9 }}>{card.label}</span>
                <span style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 3 }}>
                  {card.sub}
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section icon="globe" color="#22d3ee" title={L.uiLang} desc={L.langDesc}>
        <div style={{ maxWidth: 280 }}>
          <Segmented
            size="lg"
            value={uiLanguage}
            onChange={setUiLanguage}
            options={[
              { value: 'vi', label: 'Tiếng Việt' },
              { value: 'en', label: 'English' }
            ]}
          />
        </div>
      </Section>

      <Section icon="file" color="#f59e0b" title={L.hfTitle} desc={L.hfDesc}>
        <div>
          <input
            type="password"
            value={hfToken}
            onChange={(e) => setHfToken(e.target.value)}
            placeholder={L.hfPh}
            style={{ ...inputStyle, maxWidth: 420, ...MONO }}
          />
          <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 8 }}>{L.hfUnused}</div>
        </div>
      </Section>

      <Section
        icon="book"
        color="var(--ac-mag)"
        title={L.glossTitle}
        desc={L.glossDesc}
        right={
          glossary.length > 0 ? (
            <span style={{ fontSize: 10.5, color: 'var(--text4)', ...MONO }}>
              {glossary.length} {L.glossCount}
            </span>
          ) : undefined
        }
      >
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitTerm()}
              placeholder={L.glossSrcPh}
              style={{ ...inputStyle, flex: 1, minWidth: 150, height: 36 }}
            />
            <span style={{ alignSelf: 'center', color: 'var(--text4)', display: 'flex' }}>
              <Icon name="arrow-right" size={16} />
            </span>
            <input
              value={dst}
              onChange={(e) => setDst(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitTerm()}
              placeholder={L.glossDstPh}
              style={{ ...inputStyle, flex: 1, minWidth: 150, height: 36 }}
            />
            <button onClick={submitTerm} style={{ ...primaryButton, height: 36 }}>
              {L.glossAdd}
            </button>
          </div>

          {glossary.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text5)' }}>{L.glossEmpty}</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {glossary.map((entry) => (
                <span
                  key={entry.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 9,
                    background: 'var(--surface)',
                    border: '1px solid var(--line-strong)',
                    fontSize: 12
                  }}
                >
                  <span style={{ color: 'var(--text3)', ...MONO }}>{entry.source}</span>
                  <Icon name="arrow-right" size={12} strokeWidth={2.4} />
                  <span style={{ fontWeight: 600, ...MONO }}>{entry.target}</span>
                  <button
                    className="dangerbtn"
                    onClick={() => removeGlossary(entry.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text4)',
                      cursor: 'pointer'
                    }}
                  >
                    <Icon name="x" size={12} strokeWidth={2.4} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}
