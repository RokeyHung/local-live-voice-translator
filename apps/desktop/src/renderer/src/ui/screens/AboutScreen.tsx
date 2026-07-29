// Màn Về ứng dụng: phiên bản (từ /health), công nghệ lõi, quyền riêng tư, liên kết.

import type { JSX } from 'react'
import { PLATFORM } from '../../application/config'
import { useHealth } from '../../hooks/use-health'
import { useDict } from '../../hooks/use-ui'
import { Icon, type IconName } from '../components/Icon'
import { ScreenHeader } from '../components/primitives'
import { SCREEN } from '../styles'

const REPO = 'https://github.com/RokeyHung/local-live-voice-translator'

const STACK: { tag: string; color: string; name: string; note: string }[] = [
  { tag: 'ASR', color: '#22d3ee', name: 'whisper.cpp', note: 'Speech recognition' },
  { tag: 'MT', color: '#fb923c', name: 'NLLB-200 · transformers', note: 'Machine translation' },
  { tag: 'TTS', color: '#d946ef', name: 'sherpa-onnx · Piper VITS', note: 'Speech synthesis' },
  { tag: 'VAD', color: 'var(--ac-grn2)', name: 'Silero VAD', note: 'Voice activity detection' }
]

const ROW = 'flex items-center gap-3 border-b border-line-soft px-4.5 py-3.25 text-base text-fg-2'

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
      <span className="flex-1">{label}</span>
      {value && <span className="font-mono text-[11px] text-fg-4">{value}</span>}
    </>
  )
  return href ? (
    <a
      className={`${ROW} transition-colors hover:bg-surface`}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {content}
    </a>
  ) : (
    <div className={ROW}>{content}</div>
  )
}

function Meta({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <span className="text-fg-3">
      {label} <span className="font-semibold text-fg">{value}</span>
    </span>
  )
}

export function AboutScreen(): JSX.Element {
  const L = useDict()
  const health = useHealth()

  return (
    <div className={`${SCREEN} max-w-195`}>
      <ScreenHeader
        icon="info"
        title={L.about}
        subtitle={L.aboutSub}
        color="#818cf8"
        tint="rgba(129,140,248,.14)"
      />

      <div className="panel flex items-center gap-5 p-6">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-3xl bg-linear-[135deg,#22d3ee,#3b82f6] text-[#04121a] shadow-[0_10px_30px_rgba(34,211,238,.35)]">
          <Icon name="mic" size={34} strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-extrabold tracking-[-0.3px]">{L.appName}</div>
          <div className="mt-1 text-md leading-snug text-fg-3">{L.aboutTagline}</div>
          <div className="mt-3.5 flex gap-5 font-mono text-sm">
            <Meta label={L.aboutVersion} value={__APP_VERSION__} />
            <Meta label={L.aboutBuild} value={health.data?.version ?? '—'} />
            <Meta label={L.aboutPlatform} value={health.data?.platform ?? PLATFORM} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div className="panel px-5 py-4.5">
          <div className="mb-3.5 flex items-center gap-2.25">
            <span className="flex text-[#a855f7]">
              <Icon name="box" size={16} />
            </span>
            <div className="text-md font-bold">{L.aboutStackT}</div>
          </div>
          <div className="flex flex-col gap-2.75">
            {STACK.map((item) => (
              <div key={item.tag} className="flex items-center gap-2.75">
                <span
                  className="w-10.5 text-2xs font-bold tracking-[0.5px]"
                  style={{ color: item.color }}
                >
                  {item.tag}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-base font-semibold">{item.name}</div>
                  <div className="text-xs text-fg-4">{item.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-[rgba(34,197,94,.25)] bg-[rgba(34,197,94,.06)] px-5 py-4.5 backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2.25">
            <span className="flex text-[#22c55e]">
              <Icon name="shield" size={16} />
            </span>
            <div className="text-md font-bold text-ac-grn">{L.aboutPrivacyT}</div>
          </div>
          <div className="text-base leading-relaxed text-fg-2">{L.aboutPrivacyB}</div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-line bg-surface px-4.5 py-3.25 text-base font-bold">
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
