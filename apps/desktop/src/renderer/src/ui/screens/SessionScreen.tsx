// Màn Phiên dịch: chọn cặp ngôn ngữ + chế độ, xem phụ đề song ngữ theo 3 bố cục,
// và điều khiển phiên (Bắt đầu/Dừng, PTT, Mute).

import { useMemo, type JSX } from 'react'
import { looksLikeHeadphones } from '../../adapters/audio-devices'
import { languageName, type Dict } from '../../application/i18n'
import { utteranceSide } from '../../application/utterances'
import type { Language } from '../../domain/enums'
import { LANGUAGES } from '../../domain/models'
import type { SessionActions } from '../../hooks/use-session'
import { useAudioDevices, useDict } from '../../hooks/use-ui'
import { useSessionStore } from '../../stores/session-store'
import { useUiStore } from '../../stores/ui-store'
import { Icon, type IconName } from '../components/Icon'
import { Badge, Dot, EmptyState, Notice, ScreenHeader, Segmented } from '../components/primitives'
import { UtteranceBubble, UtteranceFocus, UtteranceRow } from '../components/UtteranceViews'
import { Visualizer } from '../components/Visualizer'
import { PANEL, selectStyle } from '../styles'
import { SIDE_COLOR, toView, type ViewUtterance } from '../utterance-view'

function ModeButton({
  active,
  disabled,
  label,
  sub,
  icon,
  onClick
}: {
  active: boolean
  disabled: boolean
  label: string
  sub: string
  icon: IconName
  onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        padding: '13px 16px',
        borderRadius: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all .18s',
        border: `1px solid ${active ? 'rgba(34,211,238,.5)' : 'var(--line)'}`,
        background: active ? 'rgba(34,211,238,.1)' : 'var(--surface)',
        color: active ? 'var(--ac-cyan)' : 'var(--text2)',
        boxShadow: active ? '0 0 16px rgba(34,211,238,.15)' : 'none',
        opacity: disabled && !active ? 0.55 : 1,
        fontWeight: 700,
        fontSize: 14
      }}
    >
      <Icon name={icon} size={16} />
      <span>{label}</span>
      <span style={{ fontSize: 10.5, opacity: 0.7, fontWeight: 500 }}>{sub}</span>
    </button>
  )
}

function ColumnPanel({
  title,
  direction,
  color,
  items,
  emptyIcon,
  emptyText,
  L
}: {
  title: string
  direction: string
  color: string
  items: ViewUtterance[]
  emptyIcon: IconName
  emptyText: string
  L: Dict
}): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        overflow: 'hidden',
        border: `1px solid ${color}38`,
        background: 'var(--panel)',
        backdropFilter: 'blur(20px)',
        minHeight: 0
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '13px 16px',
          borderBottom: '1px solid var(--line)',
          background: `${color}12`
        }}
      >
        <Dot color={color} size={8} />
        <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.4, color }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{direction}</span>
      </div>
      <div
        className="cs"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 14
        }}
      >
        {items.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              color: 'var(--text5)',
              padding: '24px 0'
            }}
          >
            <span style={{ animation: 'softpulse 2.5s ease-in-out infinite' }}>
              <Icon name={emptyIcon} size={34} strokeWidth={1.4} />
            </span>
            <div style={{ fontSize: 12.5, textAlign: 'center' }}>{emptyText}</div>
          </div>
        ) : (
          items.map((u) => <UtteranceRow key={u.id} u={u} L={L} />)
        )}
      </div>
    </div>
  )
}

export function SessionScreen({ actions }: { actions: SessionActions }): JSX.Element {
  const L = useDict()
  const uiLanguage = useUiStore((s) => s.uiLanguage)
  const layout = useUiStore((s) => s.layout)
  const setLayout = useUiStore((s) => s.setLayout)
  const glossary = useUiStore((s) => s.glossary)
  const outputDeviceId = useUiStore((s) => s.outputDeviceId)
  const virtualMicDeviceId = useUiStore((s) => s.virtualMicDeviceId)

  const config = useSessionStore((s) => s.config)
  const setConfig = useSessionStore((s) => s.setConfig)
  const active = useSessionStore((s) => s.active)
  const muted = useSessionStore((s) => s.muted)
  const ptt = useSessionStore((s) => s.ptt)
  const micLevel = useSessionStore((s) => s.micLevel)
  const utterances = useSessionStore((s) => s.utterances)
  const metrics = useSessionStore((s) => s.metrics)
  const wsStatus = useSessionStore((s) => s.wsStatus)
  const lastError = useSessionStore((s) => s.lastError)

  const { outputs } = useAudioDevices()
  const wsOk = wsStatus === 'connected'

  // Ngôn ngữ cuộc họp = nguồn của chiều incoming; "dịch sang" = ngôn ngữ của mình.
  const meetingLang = config.incoming.source
  const myLang = config.outgoing.source

  const setPair = (meeting: Language, mine: Language): void =>
    setConfig({
      incoming: { source: meeting, target: mine },
      outgoing: { source: mine, target: meeting }
    })

  const views = useMemo(
    () => utterances.map((u) => toView(u, utteranceSide(u, config), glossary)),
    [utterances, config, glossary]
  )
  const remoteList = views.filter((u) => u.side === 'remote')
  const meList = views.filter((u) => u.side === 'me')
  const latest = views[views.length - 1] ?? null

  const outputLabel = outputs.find((d) => d.deviceId === outputDeviceId)?.label ?? ''
  const loopRisk = active && outputLabel !== '' && !looksLikeHeadphones(outputLabel)
  const vmicOn = active && !muted && virtualMicDeviceId !== ''
  const pttDisabled = !active || muted || config.mode === 'listen'

  const ms = (value: number | null): string => (value == null ? '—' : String(value))

  return (
    <div
      style={{
        padding: '22px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: '100%'
      }}
    >
      <ScreenHeader
        icon="wave"
        title={L.session}
        color="#22d3ee"
        tint="rgba(34,211,238,.12)"
        right={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <div
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 0.7,
                color: 'var(--text4)',
                fontWeight: 700
              }}
            >
              {L.layout}
            </div>
            <Segmented
              value={layout}
              onChange={setLayout}
              options={[
                { value: 'split', label: L.vSplit },
                { value: 'timeline', label: L.vTimeline },
                { value: 'focus', label: L.vFocus }
              ]}
            />
          </div>
        }
      />

      {/* cặp ngôn ngữ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              color: 'var(--text4)',
              fontWeight: 700
            }}
          >
            <Dot color="#d946ef" size={7} glow={false} />
            {L.meetingLangLbl}
          </span>
          <select
            value={meetingLang}
            disabled={active}
            onChange={(e) => {
              const value = e.target.value as Language
              setPair(value, value === myLang ? meetingLang : myLang)
            }}
            style={selectStyle}
          >
            {LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {languageName(uiLanguage, code)}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setPair(myLang, meetingLang)}
          disabled={active}
          title={L.swapLangs}
          style={{
            width: 32,
            height: 32,
            marginTop: 16,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            background: 'var(--surface)',
            border: '1px solid var(--line-strong)',
            color: 'var(--text3)',
            cursor: active ? 'not-allowed' : 'pointer',
            opacity: active ? 0.5 : 1
          }}
        >
          <Icon name="swap" size={15} />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              color: 'var(--text4)',
              fontWeight: 700
            }}
          >
            <Dot color="#22d3ee" size={7} glow={false} />
            {L.myLangLbl}
          </span>
          <select
            value={myLang}
            disabled={active}
            onChange={(e) => {
              const value = e.target.value as Language
              setPair(value === meetingLang ? myLang : meetingLang, value)
            }}
            style={selectStyle}
          >
            {LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {languageName(uiLanguage, code)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* chế độ */}
      <div style={{ display: 'flex', gap: 10 }}>
        {(
          [
            { mode: 'listen', label: L.listen, sub: L.listenSub, icon: 'wave' },
            { mode: 'speak', label: L.speak, sub: L.speakSub, icon: 'mic' },
            { mode: 'two_way', label: L.twoway, sub: L.twowaySub, icon: 'swap' }
          ] as const
        ).map((item) => (
          <ModeButton
            key={item.mode}
            active={config.mode === item.mode}
            disabled={active}
            label={item.label}
            sub={item.sub}
            icon={item.icon}
            onClick={() => setConfig({ mode: item.mode })}
          />
        ))}
      </div>

      {wsStatus === 'connecting' && <Notice tone="info" icon="spinner" title={L.connecting} />}
      {wsStatus === 'disconnected' && (
        <Notice tone="warn" icon="warning" title={L.serviceDown} body={L.serviceDownSub} />
      )}
      {lastError && (
        <Notice tone="error" icon="warning" title={lastError.code} body={lastError.message} />
      )}

      {/* nội dung theo bố cục */}
      {layout === 'split' && (
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
            minHeight: 260
          }}
        >
          <ColumnPanel
            title="REMOTE"
            direction={`${languageName(uiLanguage, meetingLang)} → ${languageName(uiLanguage, myLang)}`}
            color={SIDE_COLOR.remote}
            items={remoteList}
            emptyIcon="wave"
            emptyText={config.mode === 'speak' ? L.remoteSourceMissing : L.waitRemote}
            L={L}
          />
          <ColumnPanel
            title="ME"
            direction={`${languageName(uiLanguage, myLang)} → ${languageName(uiLanguage, meetingLang)}`}
            color={SIDE_COLOR.me}
            items={meList}
            emptyIcon="mic"
            emptyText={L.waitMe}
            L={L}
          />
        </div>
      )}

      {layout === 'timeline' && (
        <div
          className="cs"
          style={{
            ...PANEL,
            flex: 1,
            overflowY: 'auto',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minHeight: 260
          }}
        >
          {views.length === 0 ? (
            <EmptyState icon="clock" title={L.idleHint} minHeight={220} />
          ) : (
            views.map((u) => <UtteranceBubble key={u.id} u={u} L={L} />)
          )}
        </div>
      )}

      {layout === 'focus' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 260 }}>
          <div
            style={{
              ...PANEL,
              borderRadius: 18,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '40px 44px',
              minHeight: 0
            }}
          >
            {latest ? (
              <UtteranceFocus u={latest} L={L} />
            ) : (
              <EmptyState icon="monitor" title={L.idleHint} minHeight={180} />
            )}
          </div>
          <div
            className="cs"
            style={{
              height: 120,
              flexShrink: 0,
              overflowY: 'auto',
              borderRadius: 14,
              border: '1px solid var(--line)',
              background: 'var(--inset)',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 9
            }}
          >
            {views.slice(-4).map((u) => (
              <div
                key={u.id}
                style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 12.5 }}
              >
                <Dot color={SIDE_COLOR[u.side]} size={7} glow={false} />
                <span
                  style={{
                    color: 'var(--text4)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    flexShrink: 0
                  }}
                >
                  {new Date(u.at).toLocaleTimeString()}
                </span>
                <span
                  style={{
                    color: 'var(--text2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {u.displayTarget || u.sourceText}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* mức tín hiệu */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 12 }}>
        <Visualizer
          label={L.vizRemote}
          level={0}
          color="#d946ef"
          active={false}
          note={L.deferred}
        />
        <Visualizer label={L.vizMe} level={micLevel} color="#22d3ee" active={active && !muted} />
      </div>

      {/* điều khiển */}
      <div
        style={{
          ...PANEL,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 18px',
          flexWrap: 'wrap'
        }}
      >
        <button
          onClick={() => (active ? actions.stop() : actions.start())}
          disabled={!wsOk}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
            height: 42,
            padding: '0 22px',
            borderRadius: 11,
            fontSize: 14,
            fontWeight: 700,
            cursor: wsOk ? 'pointer' : 'not-allowed',
            opacity: wsOk ? 1 : 0.5,
            border: active ? '1px solid rgba(239,68,68,.3)' : '1px solid transparent',
            color: active ? 'var(--ac-red)' : '#04121a',
            background: active ? 'rgba(239,68,68,.12)' : 'linear-gradient(135deg,#22d3ee,#3b82f6)',
            boxShadow: active ? 'none' : '0 6px 20px rgba(34,211,238,.3)'
          }}
        >
          <Icon name={active ? 'pause' : 'play'} size={16} />
          {active ? L.stop : L.start}
        </button>

        <button
          onMouseDown={() => actions.ptt(true)}
          onMouseUp={() => actions.ptt(false)}
          onMouseLeave={() => ptt && actions.ptt(false)}
          disabled={pttDisabled}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            height: 42,
            padding: '0 18px',
            borderRadius: 11,
            fontSize: 13,
            fontWeight: 700,
            cursor: pttDisabled ? 'not-allowed' : 'pointer',
            opacity: pttDisabled ? 0.45 : 1,
            userSelect: 'none',
            transition: 'all .12s',
            border: `1px solid ${ptt ? 'rgba(217,70,239,.6)' : 'var(--line-strong)'}`,
            background: ptt ? 'rgba(217,70,239,.18)' : 'var(--line-soft)',
            color: ptt ? 'var(--ac-mag)' : 'var(--text2)',
            boxShadow: ptt ? '0 0 18px rgba(217,70,239,.3)' : 'none'
          }}
        >
          <Icon name="mic" size={16} />
          {ptt ? L.recording : L.ptt}
        </button>

        <button
          onClick={() => actions.mute(!muted)}
          disabled={!active}
          style={{
            height: 42,
            padding: '0 16px',
            borderRadius: 11,
            fontSize: 13,
            fontWeight: 600,
            cursor: active ? 'pointer' : 'not-allowed',
            opacity: active ? 1 : 0.45,
            border: `1px solid ${muted ? 'rgba(251,146,60,.4)' : 'var(--line-strong)'}`,
            background: muted ? 'rgba(251,146,60,.12)' : 'var(--line-soft)',
            color: muted ? 'var(--ac-org)' : 'var(--text2)'
          }}
        >
          {muted ? L.unmute : L.mute}
        </button>

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontFamily: 'var(--font-mono)',
            fontSize: 11.5
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Dot color={active ? '#22c55e' : 'var(--text5)'} size={7} glow={active} />
            <span style={{ color: 'var(--text3)' }}>{L.mic}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Dot color={vmicOn ? '#d946ef' : 'var(--text5)'} size={7} glow={vmicOn} />
            <span style={{ color: 'var(--text3)' }}>{L.vmic}</span>
          </div>
          <span style={{ color: 'var(--text5)' }}>|</span>
          <span style={{ color: 'var(--ac-cyan)' }}>ASR {ms(metrics.lastAsrMs)}ms</span>
          <span style={{ color: 'var(--ac-org)' }}>MT {ms(metrics.lastMtMs)}ms</span>
          <span style={{ color: 'var(--ac-mag)' }}>TTS {ms(metrics.lastTtsDurationMs)}ms</span>
          {metrics.measured && <Badge color="var(--text4)">client</Badge>}
        </div>
      </div>

      {loopRisk && <Notice tone="warn" icon="warning" title={L.loopWarn} />}
    </div>
  )
}
