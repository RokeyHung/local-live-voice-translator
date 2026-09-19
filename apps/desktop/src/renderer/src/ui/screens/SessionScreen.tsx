// Màn Phiên dịch — MỘT bố cục duy nhất, dựng cho cuộc họp.
//
// Trên cùng: cặp ngôn ngữ + hai nguồn tiếng + đồng hồ phiên, gói trong một hàng để
// nhường chỗ cho phần chính. Giữa: dòng thời gian lời thoại (như phụ đề Zoom/Meet/
// Teams) — cuộc họp là hỏi–đáp nối tiếp nhau, chia hai cột làm mất thứ tự. Dưới: khung
// Duyệt (khi bật) và thanh điều khiển. Ba bố cục cũ (Chia đôi / Dòng thời gian / Tập
// trung) đã bỏ cùng với tích hợp Google Meet.

import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { looksLikeHeadphones } from '../../adapters/audio-devices'
import { format, languageName, type Dict } from '../../application/i18n'
import {
  formatElapsed,
  isTypingTarget,
  modeFromToggles,
  togglesFromMode
} from '../../application/meeting'
import { utteranceSide } from '../../application/utterances'
import type { Language } from '../../domain/enums'
import { LANGUAGES, type LoadProgress } from '../../domain/models'
import { useLoadProgress, useServiceConfig } from '../../hooks/use-config'
import type { SessionActions } from '../../hooks/use-session'
import { useAudioDevices, useDict, useFollowLatest, useIsScreen } from '../../hooks/use-ui'
import { useSessionStore } from '../../stores/session-store'
import { useUiStore } from '../../stores/ui-store'
import { Icon, type IconName } from '../components/Icon'
import { Badge, Dot, EmptyState, Meter, Notice } from '../components/primitives'
import { ReviewPanel } from '../components/ReviewPanel'
import { MeetingBubble } from '../components/UtteranceViews'
import { SCREEN, SELECT, SELECT_ARROW } from '../styles'
import { SIDE_COLOR, toView, type ViewUtterance } from '../utterance-view'

/** Ô chọn ngôn ngữ gọn, nhãn nằm cùng hàng để cả cặp vừa trên thanh trên cùng. */
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
    <label className="flex items-center gap-2">
      <span className="label-caps inline-flex items-center gap-1.5 whitespace-nowrap">
        <Dot color={dotColor} size={7} glow={false} />
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as Language)}
        className={`${SELECT} h-8.5`}
        style={SELECT_ARROW}
      >
        {LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {languageName(uiLanguage, code)}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Công tắc một nguồn tiếng (cuộc họp / giọng mình). */
function SourceToggle({
  on,
  color,
  icon,
  label,
  sub,
  disabled,
  reason,
  onToggle
}: {
  on: boolean
  color: string
  icon: IconName
  label: string
  sub: string
  disabled: boolean
  reason?: string
  onToggle: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      disabled={disabled}
      title={disabled ? reason : sub}
      className="flex cursor-pointer items-center gap-2.5 rounded-[11px] border px-3 py-1.75 text-left transition-colors disabled:cursor-not-allowed"
      style={{
        borderColor: on ? `${color}88` : 'var(--line)',
        background: on ? `${color}14` : 'var(--surface)',
        opacity: disabled && !on ? 0.55 : 1
      }}
    >
      <span className="flex" style={{ color: on ? color : 'var(--text4)' }}>
        <Icon name={icon} size={16} />
      </span>
      <span className="flex flex-col">
        <span className="text-md leading-tight font-bold" style={{ color: on ? color : undefined }}>
          {label}
        </span>
        <span className="text-2xs leading-tight text-fg-4">{sub}</span>
      </span>
      {/* công tắc dạng trượt: đọc được trạng thái bằng mắt mà không cần đọc chữ */}
      <span
        className="relative ml-1 h-4.5 w-8 shrink-0 rounded-full transition-colors"
        style={{ background: on ? color : 'var(--line-strong)' }}
      >
        <span
          className="absolute top-0.5 size-3.5 rounded-full bg-white transition-all"
          style={{ left: on ? 14 : 2 }}
        />
      </span>
    </button>
  )
}

/** Mức tín hiệu thu nhỏ, đặt ngay trên thanh điều khiển. */
function MiniMeter({
  label,
  level,
  color,
  active,
  note
}: {
  label: string
  level: number
  color: string
  active: boolean
  note?: string
}): JSX.Element {
  return (
    <div className="flex items-center gap-2" title={note}>
      <span className="text-sm whitespace-nowrap text-fg-3">{label}</span>
      <div className={`flex w-20 ${active ? '' : 'opacity-35'}`}>
        <Meter value={active ? Math.min(1, level * 4) : 0} color={color} height={6} />
      </div>
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

/** Đủ để biết danh sách có gì mới: thêm câu, hoặc câu cuối vừa có chữ / bản dịch. */
function tailSignature(items: ViewUtterance[]): string {
  const tail = items[items.length - 1]
  return `${items.length}|${tail?.id ?? ''}|${tail ? tail.displayTarget || tail.sourceText : ''}`
}

/** Đồng hồ phiên: tích tắc mỗi giây khi đang có phiên; mốc bắt đầu nằm trong store. */
function useElapsed(startedAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (startedAt === null) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [startedAt])
  return startedAt === null ? null : Math.max(0, now - startedAt)
}

export function SessionScreen({ actions }: { actions: SessionActions }): JSX.Element {
  const L = useDict()
  const uiLanguage = useUiStore((s) => s.uiLanguage)
  const glossary = useUiStore((s) => s.glossary)
  const reviewCountdownSec = useUiStore((s) => s.reviewCountdownSec)
  const outputDeviceId = useUiStore((s) => s.outputDeviceId)
  const visible = useIsScreen('session')

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
  const startedAt = useSessionStore((s) => s.startedAt)
  const elapsed = useElapsed(startedAt)

  // Ngôn ngữ cuộc họp = nguồn của chiều incoming; "Tôi" = ngôn ngữ của mình.
  const meetingLang = config.incoming.source
  const myLang = config.outgoing.source

  const setPair = (meeting: Language, mine: Language): void =>
    setConfig({
      incoming: { source: meeting, target: mine },
      outgoing: { source: mine, target: meeting }
    })

  const sources = togglesFromMode(config.mode)
  const toggleSource = (which: 'listen' | 'me'): void => {
    const next = { ...sources, [which]: !sources[which] }
    const mode = modeFromToggles(next.listen, next.me)
    if (mode) setConfig({ mode })
  }
  // Tắt nguồn cuối cùng thì không còn gì để dịch.
  const onlyOneOn = sources.listen !== sources.me

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

  const { ref: listRef, following, jump } = useFollowLatest<HTMLDivElement>(tailSignature(views))

  const outputLabel = outputs.find((d) => d.deviceId === outputDeviceId)?.label ?? ''
  const loopRisk = active && outputLabel !== '' && !looksLikeHeadphones(outputLabel)
  const spkOn = active && !muted
  const pttDisabled = !active || muted || !sources.me

  // Space = giữ để nói. Chỉ khi màn này đang mở và không gõ vào ô nhập nào (ô sửa bản
  // dịch của khung Duyệt dùng dấu cách thật).
  const spaceHeld = useRef(false)
  useEffect(() => {
    if (!visible || pttDisabled) return
    const down = (e: KeyboardEvent): void => {
      if (e.code !== 'Space' || e.repeat || isTypingTarget(e.target)) return
      e.preventDefault()
      spaceHeld.current = true
      actions.ptt(true)
    }
    const up = (e: KeyboardEvent): void => {
      if (e.code !== 'Space' || !spaceHeld.current) return
      e.preventDefault()
      spaceHeld.current = false
      actions.ptt(false)
    }
    // Rời cửa sổ khi đang giữ phím thì không bao giờ nhận được keyup — nhả luôn.
    const blur = (): void => {
      if (spaceHeld.current) {
        spaceHeld.current = false
        actions.ptt(false)
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      blur()
    }
  }, [visible, pttDisabled, actions])

  const ms = (value: number | null): string => (value == null ? '—' : String(value))
  const emptyText = !active ? L.idleHint : sources.listen ? L.waitRemote : L.waitMe

  // `flex-1 min-h-0`: màn ăn đúng chiều cao vùng nội dung, nhờ đó dòng thời gian có
  // chiều cao xác định và tự cuộn bên trong thay vì đẩy dài cả trang.
  return (
    <div className={`${SCREEN} min-h-0 flex-1`}>
      {/* thanh trên cùng: tiêu đề · cặp ngôn ngữ · nguồn tiếng · đồng hồ */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2.75">
          <span
            className="inline-flex size-8.5 shrink-0 items-center justify-center rounded-md"
            style={{ background: 'rgba(34,211,238,.12)', color: '#22d3ee' }}
          >
            <Icon name="wave" size={18} />
          </span>
          <div className="text-2xl font-extrabold tracking-[-0.3px]">{L.session}</div>
        </div>

        <div className="flex items-center gap-2">
          <LangPicker
            label={L.meetingLangLbl}
            dotColor={SIDE_COLOR.remote}
            value={meetingLang}
            disabled={active}
            uiLanguage={uiLanguage}
            onChange={(value) => setPair(value, value === myLang ? meetingLang : myLang)}
          />
          <button
            onClick={() => setPair(myLang, meetingLang)}
            disabled={active}
            title={L.swapLangs}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-line-strong bg-surface text-fg-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="swap" size={15} />
          </button>
          <LangPicker
            label={L.myLangLbl}
            dotColor={SIDE_COLOR.me}
            value={myLang}
            disabled={active}
            uiLanguage={uiLanguage}
            onChange={(value) => setPair(value === meetingLang ? myLang : meetingLang, value)}
          />
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5">
          <SourceToggle
            on={sources.listen}
            color={SIDE_COLOR.remote}
            icon="wave"
            label={L.srcMeeting}
            sub={L.srcMeetingSub}
            disabled={active || (sources.listen && onlyOneOn)}
            reason={active ? undefined : L.srcLastOne}
            onToggle={() => toggleSource('listen')}
          />
          <SourceToggle
            on={sources.me}
            color={SIDE_COLOR.me}
            icon="mic"
            label={L.srcMe}
            sub={L.srcMeSub}
            disabled={active || (sources.me && onlyOneOn)}
            reason={active ? undefined : L.srcLastOne}
            onToggle={() => toggleSource('me')}
          />
          {elapsed !== null && (
            <span className="ml-1 flex items-center gap-2 font-mono text-sm text-fg-3">
              <Dot color="#ef4444" size={7} pulse />
              {formatElapsed(elapsed)} · {format(L.lineCount, { n: views.length })}
            </span>
          )}
        </div>
      </div>

      {wsStatus === 'connecting' && <Notice tone="info" icon="spinner" title={L.connecting} />}
      {wsStatus === 'disconnected' && (
        <Notice tone="warn" icon="warning" title={L.serviceDown} body={L.serviceDownSub} />
      )}
      {lastError && (
        <Notice tone="error" icon="warning" title={lastError.code} body={lastError.message} />
      )}

      {/* Bắt đầu phiên khi model chưa nạp: service nạp ngay lúc đó, câu đầu tiên sẽ
          phải chờ. Nói rõ để người dùng không tưởng ứng dụng bị treo. */}
      {active && !modelsLoaded && <StartupActivity progress={loadProgress.data} L={L} />}

      {/* dòng thời gian lời thoại */}
      <div className="relative flex min-h-65 flex-1 flex-col">
        <div
          ref={listRef}
          className="panel cs flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-5"
        >
          {views.length === 0 ? (
            <EmptyState icon={active ? 'wave' : 'clock'} title={emptyText} minHeight={220} />
          ) : (
            <>
              {views.map((u) => (
                <MeetingBubble key={u.id} u={u} L={L} />
              ))}
            </>
          )}
        </div>
        {!following && (
          <button
            onClick={jump}
            className="absolute right-5 bottom-4 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 py-1.75 text-sm font-semibold text-fg shadow-[0_6px_18px_rgba(0,0,0,.18)]"
          >
            <Icon name="arrow-down" size={14} />
            {L.jumpLatest}
          </button>
        )}
      </div>

      {/* Duyệt trước khi đọc (SPEC 7.10) — sát thanh điều khiển vì nó đang chặn luồng:
          chưa bấm thì chưa có gì được đọc ra. */}
      <ReviewPanel
        items={reviewItems}
        countdownSec={reviewCountdownSec}
        onEdit={setReviewDraft}
        onSend={(id) => actions.confirm(id, reviewDrafts[id] ?? '')}
        onDiscard={(id) => actions.discard(id)}
        L={L}
      />

      {/* thanh điều khiển */}
      <div className="panel flex flex-wrap items-center gap-3.5 px-4.5 py-3">
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
              ? 'border-[rgba(34,211,238,.6)] bg-[rgba(34,211,238,.16)] text-ac-cyan shadow-[0_0_18px_rgba(34,211,238,.3)]'
              : 'border-line-strong bg-line-soft text-fg-2'
          ].join(' ')}
        >
          <Icon name="mic" size={16} />
          {ptt ? L.recording : L.ptt}
          <kbd className="rounded-xs border border-line-strong px-1.5 font-mono text-2xs text-fg-4">
            {L.pttKey}
          </kbd>
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

        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-4">
            {sources.listen && (
              <MiniMeter
                label={L.sideMeeting}
                level={systemLevel}
                color={SIDE_COLOR.remote}
                active={active && systemCapturing}
                note={ducking ? L.ducking : undefined}
              />
            )}
            {sources.me && (
              <MiniMeter
                label={L.sideMe}
                level={micLevel}
                color={SIDE_COLOR.me}
                active={active && !muted}
              />
            )}
            <div className="flex items-center gap-1.5 text-sm">
              <Dot color={spkOn ? '#fb923c' : 'var(--text5)'} size={7} glow={spkOn} />
              <span className="text-fg-3">{L.spk}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-ac-cyan">ASR {ms(metrics.lastAsrMs)}ms</span>
            <span className="text-ac-org">MT {ms(metrics.lastMtMs)}ms</span>
            <span className="text-ac-mag">TTS {ms(metrics.lastTtsDurationMs)}ms</span>
            {metrics.measured && <Badge color="var(--text4)">client</Badge>}
          </div>
        </div>
      </div>

      {loopRisk && <Notice tone="warn" icon="warning" title={L.loopWarn} />}
    </div>
  )
}
