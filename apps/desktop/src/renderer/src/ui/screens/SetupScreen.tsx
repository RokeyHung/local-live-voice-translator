import type { JSX } from 'react'
import { PLATFORM } from '../../application/config'
import type { Language, Preset, SessionMode } from '../../domain/enums'
import { LANGUAGE_LABELS, PRESET_LABELS } from '../../domain/models'
import { useSessionStore } from '../../stores/session-store'
import { HealthCard } from '../components/HealthCard'
import { OutputDevicePicker } from '../components/OutputDevicePicker'
import { Select, type Option } from '../components/Select'

const MODE_OPTIONS: Option<SessionMode>[] = [
  { value: 'two_way', label: 'Hai chiều (Two-way)' },
  { value: 'speak', label: 'Nói (mic → remote)' },
  { value: 'listen', label: 'Nghe (remote → mic)' }
]

const LANG_OPTIONS: Option<Language>[] = (Object.keys(LANGUAGE_LABELS) as Language[]).map((l) => ({
  value: l,
  label: LANGUAGE_LABELS[l]
}))

const PRESET_OPTIONS: Option<Preset>[] = (Object.keys(PRESET_LABELS) as Preset[]).map((p) => ({
  value: p,
  label: PRESET_LABELS[p]
}))

export function SetupScreen(): JSX.Element {
  const config = useSessionStore((s) => s.config)
  const setConfig = useSessionStore((s) => s.setConfig)
  const active = useSessionStore((s) => s.active)

  const showOutgoing = config.mode !== 'listen'
  const showIncoming = config.mode !== 'speak'

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 font-medium">Thiết lập phiên</h2>
        <div className="space-y-3">
          <Select
            label="Chế độ"
            value={config.mode}
            options={MODE_OPTIONS}
            disabled={active}
            onChange={(mode) => setConfig({ mode })}
          />
          <Select
            label="Preset"
            value={config.preset}
            options={PRESET_OPTIONS}
            disabled={active}
            onChange={(preset) => setConfig({ preset })}
          />

          {showOutgoing && (
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-950/40 p-3">
              <p className="col-span-2 text-xs uppercase tracking-wide text-slate-500">
                Outgoing · mic → remote
              </p>
              <Select
                label="Nguồn"
                value={config.outgoing.source}
                options={LANG_OPTIONS}
                disabled={active}
                onChange={(source) => setConfig({ outgoing: { ...config.outgoing, source } })}
              />
              <Select
                label="Đích"
                value={config.outgoing.target}
                options={LANG_OPTIONS}
                disabled={active}
                onChange={(target) => setConfig({ outgoing: { ...config.outgoing, target } })}
              />
            </div>
          )}

          {showIncoming && (
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-950/40 p-3">
              <p className="col-span-2 text-xs uppercase tracking-wide text-slate-500">
                Incoming · remote → mic
              </p>
              <Select
                label="Nguồn"
                value={config.incoming.source}
                options={LANG_OPTIONS}
                disabled={active}
                onChange={(source) => setConfig({ incoming: { ...config.incoming, source } })}
              />
              <Select
                label="Đích"
                value={config.incoming.target}
                options={LANG_OPTIONS}
                disabled={active}
                onChange={(target) => setConfig({ incoming: { ...config.incoming, target } })}
              />
            </div>
          )}
        </div>
        {active && (
          <p className="mt-3 text-xs text-amber-400">
            Đang trong phiên — dừng phiên để đổi thiết lập.
          </p>
        )}
      </section>

      <div className="space-y-4">
        <HealthCard />
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm">
          <h2 className="mb-3 font-medium">Thiết bị</h2>
          <p className="text-slate-400">
            Nền tảng: <span className="font-mono text-slate-200">{PLATFORM}</span>
          </p>
          <p className="mb-3 mt-1 text-slate-400">Đầu vào: microphone hệ thống (16 kHz mono).</p>
          <OutputDevicePicker />
          <p className="mt-3 rounded bg-amber-950/40 p-2 text-xs text-amber-300">
            Nên dùng tai nghe để tránh mic thu lại giọng TTS (vòng lặp âm thanh). Thu system audio
            (nguồn incoming) sẽ bổ sung ở bước sau.
          </p>
        </section>
      </div>
    </div>
  )
}
