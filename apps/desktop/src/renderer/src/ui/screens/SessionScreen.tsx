// Màn Phiên dịch: chọn cặp ngôn ngữ + chế độ, xem phụ đề song ngữ theo 3 bố cục,
// và điều khiển phiên (Bắt đầu/Dừng, PTT, Mute).

import { useMemo, type JSX } from 'react'
import { looksLikeHeadphones } from '../../adapters/audio-devices'
import { languageName, type Dict } from '../../application/i18n'
import { utteranceSide } from '../../application/utterances'
import type { Language } from '../../domain/enums'
import { LANGUAGES, type LoadProgress } from '../../domain/models'
import { useLoadProgress, useServiceConfig } from '../../hooks/use-config'
import type { SessionActions } from '../../hooks/use-session'
import { useAudioDevices, useDict, useStickyBottom } from '../../hooks/use-ui'
import { useSessionStore } from '../../stores/session-store'
import { useUiStore } from '../../stores/ui-store'
import { Icon, type IconName } from '../components/Icon'
import {
  Badge,
  Dot,
  EmptyState,
  Meter,
  Notice,
  ScreenHeader,
  Segmented
} from '../components/primitives'
import { ReviewPanel } from '../components/ReviewPanel'
import { UtteranceBubble, UtteranceFocus, UtteranceRow } from '../components/UtteranceViews'
import { Visualizer } from '../components/Visualizer'
import { SCREEN, SELECT, SELECT_ARROW } from '../styles'
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
      className={[
        'flex flex-1 flex-col items-start gap-0.5 rounded-[13px] border px-4 py-3.25 text-[14px] font-bold transition-all',
        'disabled:cursor-not-allowed',
        active
          ? 'border-[rgba(34,211,238,.5)] bg-[rgba(34,211,238,.1)] text-ac-cyan shadow-[0_0_16px_rgba(34,211,238,.15)]'
          : 'border-line bg-surface text-fg-2 hover:border-line-strong',
        disabled && !active ? 'opacity-55' : ''
      ].join(' ')}
    >
      <Icon name={icon} size={16} />
      <span>{label}</span>
      <span className="text-xs font-medium opacity-70">{sub}</span>
    </button>
  )
}

/** Nhãn "Ngôn ngữ cuộc họp" / "Dịch sang" + ô chọn. */
function LangPicker({
  label,
  dotColor,
  value,
  disabled,
  uiLanguage,
  onChange
}: {
  label: string
  dotColor: string
  value: Language
  disabled: boolean
  uiLanguage: 'vi' | 'en'
  onChange: (value: Language) => void
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="label-caps inline-flex items-center gap-1.5">
        <Dot color={dotColor} size={7} glow={false} />
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as Language)}
        className={SELECT}
        style={SELECT_ARROW}
      >
        {LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {languageName(uiLanguage, code)}
          </option>
        ))}
      </select>
    </div>
  )
}

// Dải "đang nạp model" hiện ngay trong phiên: model nạp theo nhu cầu nên phiên có
// thể bắt đầu lúc bộ nhớ còn trống, câu đầu tiên phải chờ nạp xong.
//
// Tên model và phần trăm là số service báo về; chưa có ảnh chụp tiến trình nào thì
// chỉ hiện dòng chờ chứ không dựng thanh giả.
function StartupActivity({ progress, L }: { progress?: LoadProgress; L: Dict }): JSX.Element {
  const stage = progress?.stages.find((s) => s.stage === progress.currentStage)
  const percent = progress?.overallPercent ?? null

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[rgba(34,211,238,.28)] bg-[rgba(34,211,238,.06)] px-4 py-3">
      <span className="flex shrink-0 text-ac-cyan">
        <Icon name="spinner" size={15} spin strokeWidth={2.6} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-base font-bold text-[#22d3ee]">{L.mbLoadT}</div>
        <div className="truncate-1 font-mono text-sm text-fg-3">{stage?.model ?? L.mbLoadS}</div>
      </div>
      {percent !== null && (
        <>
          <div className="flex w-35 shrink-0">
            <Meter value={percent / 100} color="#22d3ee" to="#3b82f6" height={6} />
          </div>
          <span className="shrink-0 font-mono text-base font-bold text-[#22d3ee]">
            {Math.round(percent)}%
          </span>
        </>
      )}
    </div>
  )
}

/** Đủ để biết danh sách có gì mới: thêm câu, hoặc câu cuối vừa dài thêm (bản nháp ASR). */
function tailSignature(items: ViewUtterance[]): string {
  const tail = items[items.length - 1]
  return `${items.length}|${tail?.id ?? ''}|${tail ? tail.displayTarget || tail.sourceText : ''}`
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
  // Mỗi cột cuộn độc lập: đọc lại phần REMOTE không kéo theo cột ME, và khung
  // điều khiển bên dưới luôn nằm trong tầm mắt.
  const listRef = useStickyBottom<HTMLDivElement>(tailSignature(items))

  return (
    <div
      className="flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-(image:--panel) backdrop-blur-xl"
      style={{ borderColor: `${color}38` }}
    >
      <div
        className="flex shrink-0 items-center gap-2.25 border-b border-line px-4 py-3.25"
        style={{ background: `${color}12` }}
      >
        <Dot color={color} size={8} />
        <span className="text-base font-bold tracking-[0.4px]" style={{ color }}>
          {title}
        </span>
        <span className="text-sm text-fg-3">{direction}</span>
      </div>
      <div ref={listRef} className="cs flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2.5 py-6 text-fg-5">
            <span className="motion-safe:animate-[softpulse_2.5s_ease-in-out_infinite]">
              <Icon name={emptyIcon} size={34} strokeWidth={1.4} />
            </span>
            <div className="text-center text-base">{emptyText}</div>
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
  const reviewCountdownSec = useUiStore((s) => s.reviewCountdownSec)
  const outputDeviceId = useUiStore((s) => s.outputDeviceId)
  const virtualMicDeviceId = useUiStore((s) => s.virtualMicDeviceId)

  const config = useSessionStore((s) => s.config)
  const setConfig = useSessionStore((s) => s.setConfig)
  const active = useSessionStore((s) => s.active)
  // Model nạp theo nhu cầu nên phiên có thể bắt đầu lúc bộ nhớ còn trống.
  const serviceConfig = useServiceConfig()
  const modelsLoaded = (serviceConfig.data?.stages.length ?? 0) > 0
  const loadProgress = useLoadProgress(active && !modelsLoaded)
  const muted = useSessionStore((s) => s.muted)
  const ptt = useSessionStore((s) => s.ptt)
  const micLevel = useSessionStore((s) => s.micLevel)
  const systemLevel = useSessionStore((s) => s.systemLevel)
  const systemCapturing = useSessionStore((s) => s.systemCapturing)
  const ducking = useSessionStore((s) => s.ducking)
  const utterances = useSessionStore((s) => s.utterances)
  const reviewDrafts = useSessionStore((s) => s.reviewDrafts)
  const setReviewDraft = useSessionStore((s) => s.setReviewDraft)
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
  // Câu đang chờ duyệt. Suy từ trạng thái service báo về, không giữ danh sách riêng —
  // service mới là bên biết câu nào còn treo.
  const reviewItems = useMemo(
    () =>
      utterances
        .filter((u) => u.state === 'WaitingForConfirmation')
        .map((u) => ({
          id: u.id,
          sourceText: u.sourceText ?? '',
          draft: reviewDrafts[u.id] ?? u.translatedText ?? ''
        })),
    [utterances, reviewDrafts]
  )

  const remoteList = views.filter((u) => u.side === 'remote')
  const meList = views.filter((u) => u.side === 'me')
  const latest = views[views.length - 1] ?? null

  // Hai bố cục còn lại cũng cuộn trong khung của chúng, nên cũng cần bám đáy.
  const timelineRef = useStickyBottom<HTMLDivElement>(tailSignature(views))
  const recentRef = useStickyBottom<HTMLDivElement>(tailSignature(views))

  const outputLabel = outputs.find((d) => d.deviceId === outputDeviceId)?.label ?? ''
  const loopRisk = active && outputLabel !== '' && !looksLikeHeadphones(outputLabel)
  const vmicOn = active && !muted && virtualMicDeviceId !== ''
  const pttDisabled = !active || muted || config.mode === 'listen'

  const ms = (value: number | null): string => (value == null ? '—' : String(value))

  // `flex-1 min-h-0`: màn ăn đúng chiều cao vùng nội dung, nhờ đó vùng phụ đề có
  // chiều cao xác định và tự cuộn bên trong thay vì đẩy dài cả trang. Cửa sổ quá
  // thấp thì `min-h-65` bên dưới vẫn giữ chỗ và trang ngoài cuộn như trước.
  return (
    <div className={`${SCREEN} min-h-0 flex-1`}>
      <ScreenHeader
        icon="wave"
        title={L.session}
        color="#22d3ee"
        tint="rgba(34,211,238,.12)"
        right={
          <div className="flex flex-col items-end gap-1.5">
            <div className="label-caps tracking-[0.7px]">{L.layout}</div>
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
      <div className="flex flex-wrap items-center gap-3.5">
        <LangPicker
          label={L.meetingLangLbl}
          dotColor="#d946ef"
          value={meetingLang}
          disabled={active}
          uiLanguage={uiLanguage}
          onChange={(value) => setPair(value, value === myLang ? meetingLang : myLang)}
        />

        <button
          onClick={() => setPair(myLang, meetingLang)}
          disabled={active}
          title={L.swapLangs}
          className="mt-4 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-line-strong bg-surface text-fg-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="swap" size={15} />
        </button>

        <LangPicker
          label={L.myLangLbl}
          dotColor="#22d3ee"
          value={myLang}
          disabled={active}
          uiLanguage={uiLanguage}
          onChange={(value) => setPair(value === meetingLang ? myLang : meetingLang, value)}
        />
      </div>

      {/* chế độ */}
      <div className="flex gap-2.5">
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

      {/* Duyệt trước khi gửi (SPEC 7.10) — đặt TRÊN phần phụ đề vì nó đang chặn
          luồng: chưa bấm thì chưa có gì phát ra cuộc họp. */}
      <ReviewPanel
        items={reviewItems}
        countdownSec={reviewCountdownSec}
        onEdit={setReviewDraft}
        onSend={(id) => actions.confirm(id, reviewDrafts[id] ?? '')}
        onDiscard={(id) => actions.discard(id)}
        L={L}
      />

      {/* nội dung theo bố cục */}
      {layout === 'split' && (
        <div className="grid min-h-65 flex-1 grid-cols-2 gap-3.5">
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
          ref={timelineRef}
          className="panel cs flex min-h-65 flex-1 flex-col gap-4 overflow-y-auto p-5"
        >
          {views.length === 0 ? (
            <EmptyState icon="clock" title={L.idleHint} minHeight={220} />
          ) : (
            views.map((u) => <UtteranceBubble key={u.id} u={u} L={L} />)
          )}
        </div>
      )}

      {layout === 'focus' && (
        <div className="flex min-h-65 flex-1 flex-col gap-3.5">
          <div className="panel flex min-h-0 flex-1 flex-col justify-center rounded-3xl px-11 py-10">
            {latest ? (
              <UtteranceFocus u={latest} L={L} />
            ) : (
              <EmptyState icon="monitor" title={L.idleHint} minHeight={180} />
            )}
          </div>
          <div
            ref={recentRef}
            className="cs flex h-30 shrink-0 flex-col gap-2.25 overflow-y-auto rounded-xl border border-line bg-inset px-4 py-3"
          >
            {views.slice(-4).map((u) => (
              <div key={u.id} className="flex items-baseline gap-2.5 text-base">
                <Dot color={SIDE_COLOR[u.side]} size={7} glow={false} />
                <span className="shrink-0 font-mono text-[10px] text-fg-4">
                  {new Date(u.at).toLocaleTimeString()}
                </span>
                <span className="truncate-1 text-fg-2">{u.displayTarget || u.sourceText}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bắt đầu phiên khi model chưa nạp: service nạp ngay lúc đó, câu đầu tiên sẽ
          phải chờ. Nói rõ để người dùng không tưởng ứng dụng bị treo. */}
      {active && !modelsLoaded && <StartupActivity progress={loadProgress.data} L={L} />}

      {/* mức tín hiệu */}
      <div className="flex items-stretch gap-3">
        <Visualizer
          label={L.vizRemote}
          level={systemLevel}
          color="#d946ef"
          active={active && systemCapturing}
          note={ducking ? L.ducking : undefined}
        />
        <Visualizer label={L.vizMe} level={micLevel} color="#22d3ee" active={active && !muted} />
      </div>

      {/* điều khiển */}
      <div className="panel flex flex-wrap items-center gap-3.5 px-4.5 py-3.5">
        <button
          onClick={() => (active ? actions.stop() : actions.start())}
          disabled={!wsOk}
          className={[
            'inline-flex h-10.5 cursor-pointer items-center gap-2.25 rounded-[11px] border px-5.5 text-[14px] font-bold',
            'disabled:cursor-not-allowed disabled:opacity-50',
            active
              ? 'border-[rgba(239,68,68,.3)] bg-[rgba(239,68,68,.12)] text-ac-red'
              : 'border-transparent bg-linear-[135deg,#22d3ee,#3b82f6] text-[#04121a] shadow-[0_6px_20px_rgba(34,211,238,.3)]'
          ].join(' ')}
        >
          <Icon name={active ? 'pause' : 'play'} size={16} />
          {active ? L.stop : L.start}
        </button>

        <button
          onMouseDown={() => actions.ptt(true)}
          onMouseUp={() => actions.ptt(false)}
          onMouseLeave={() => ptt && actions.ptt(false)}
          disabled={pttDisabled}
          className={[
            'inline-flex h-10.5 cursor-pointer items-center gap-2 rounded-[11px] border px-4.5 text-md font-bold transition-all select-none',
            'disabled:cursor-not-allowed disabled:opacity-45',
            ptt
              ? 'border-[rgba(217,70,239,.6)] bg-[rgba(217,70,239,.18)] text-ac-mag shadow-[0_0_18px_rgba(217,70,239,.3)]'
              : 'border-line-strong bg-line-soft text-fg-2'
          ].join(' ')}
        >
          <Icon name="mic" size={16} />
          {ptt ? L.recording : L.ptt}
        </button>

        <button
          onClick={() => actions.mute(!muted)}
          disabled={!active}
          className={[
            'h-10.5 cursor-pointer rounded-[11px] border px-4 text-md font-semibold',
            'disabled:cursor-not-allowed disabled:opacity-45',
            muted
              ? 'border-[rgba(251,146,60,.4)] bg-[rgba(251,146,60,.12)] text-ac-org'
              : 'border-line-strong bg-line-soft text-fg-2'
          ].join(' ')}
        >
          {muted ? L.unmute : L.mute}
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-4 font-mono text-sm">
          <div className="flex items-center gap-1.5">
            <Dot color={active ? '#22c55e' : 'var(--text5)'} size={7} glow={active} />
            <span className="text-fg-3">{L.mic}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Dot color={vmicOn ? '#d946ef' : 'var(--text5)'} size={7} glow={vmicOn} />
            <span className="text-fg-3">{L.vmic}</span>
          </div>
          <span className="text-fg-5">|</span>
          <span className="text-ac-cyan">ASR {ms(metrics.lastAsrMs)}ms</span>
          <span className="text-ac-org">MT {ms(metrics.lastMtMs)}ms</span>
          <span className="text-ac-mag">TTS {ms(metrics.lastTtsDurationMs)}ms</span>
          {metrics.measured && <Badge color="var(--text4)">client</Badge>}
        </div>
      </div>

      {loopRisk && <Notice tone="warn" icon="warning" title={L.loopWarn} />}
    </div>
  )
}
