// Màn Quản lý Model: dải trạng thái lớn (khởi động / nạp lại / giải phóng), bộ chọn
// cấu hình hiệu năng, tiến trình nạp theo khâu, và hai cột "model đã cài" + "danh mục".
//
// Bốn thao tác từng phải để vô hiệu vì thiếu API — huỷ giữa chừng, cấu hình tự chọn
// từng khâu, tải model từ danh mục, xoá lẻ một model — nay đã nối thẳng vào service.

import { useMemo, useState, type JSX, type ReactNode } from 'react'
import { PLATFORM } from '../../application/config'
import { formatBytes } from '../../application/format'
import { format, type Dict } from '../../application/i18n'
import { MODEL_CATALOG, PRESET_META, STAGE_COLORS } from '../../application/presets'
import type { Preset } from '../../domain/enums'
import { PRESETS, type LoadProgress, type LoadStageStatus } from '../../domain/models'
import {
  useCancelLoadModels,
  useDeleteInstalledModel,
  useDeleteInstalledModels,
  useDownloadModel,
  useInstalledModels,
  useLoadModels,
  useLoadProgress,
  useServiceConfig,
  useSetCustomModels,
  useSetPreset,
  useUnloadModels
} from '../../hooks/use-config'
import { useHealth } from '../../hooks/use-health'
import { useCompute, useDict } from '../../hooks/use-ui'
import { useSessionStore } from '../../stores/session-store'
import { useUiStore } from '../../stores/ui-store'
import { Icon, type IconName } from '../components/Icon'
import { Badge, DisabledButton, Dot, Meter, Notice, ScreenHeader } from '../components/primitives'
import { DANGER_BUTTON, GHOST_BUTTON, INPUT, SCREEN, SELECT, SELECT_ARROW } from '../styles'

const PRESET_ICON: Record<Preset, IconName> = {
  fast: 'bolt',
  balanced: 'scale',
  quality: 'star',
  custom: 'sliders'
}

// Tiến trình nạp model: một dòng cho mỗi khâu + thanh tổng.
//
// Con số hiển thị đều là số service ĐO ĐƯỢC (byte đã nằm trên đĩa). Khâu nào không
// biết dung lượng model thì `percent` là null — hiện số MB đã tải chứ không bịa phần
// trăm; `estimated` thì kèm dấu ≈ để người đọc biết tổng chỉ là xấp xỉ.
function LoadProgressPanel({ progress, L }: { progress: LoadProgress; L: Dict }): JSX.Element {
  const overall = progress.overallPercent ?? 0
  const statusText: Record<LoadStageStatus, string> = {
    waiting: L.lpWaiting,
    downloading: L.lpDownloading,
    loading: L.lpLoading,
    done: L.lpDone,
    failed: L.lpFailed,
    cancelled: L.lpCancelled
  }

  return (
    <div className="panel px-4.5 py-4.25">
      <div className="flex items-center justify-between">
        <div className="text-base font-bold text-fg-2">{L.lpTitle}</div>
        <div className="font-mono text-md font-extrabold text-fg-2">{Math.round(overall)}%</div>
      </div>
      <div className="mt-2.5 flex">
        <Meter value={overall / 100} color="#a855f7" to="#6366f1" height={10} />
      </div>

      <div className="mt-3.5 flex flex-col gap-1.75">
        {progress.stages.map((stage) => {
          const running = stage.status === 'downloading' || stage.status === 'loading'
          const color = stage.status === 'failed' ? '#f87171' : STAGE_COLORS[stage.stage]
          // Byte: "412 MB / ≈2.5 GB" khi biết tổng, ngược lại chỉ "412 MB".
          const bytes = stage.doneBytes
            ? stage.totalBytes
              ? `${formatBytes(stage.doneBytes)} / ${stage.estimated ? '≈' : ''}${formatBytes(stage.totalBytes)}`
              : formatBytes(stage.doneBytes)
            : ''
          return (
            <div key={stage.stage} className="flex items-center gap-2.5 text-base">
              <span
                className="flex size-5 shrink-0 items-center justify-center"
                style={{ color: stage.status === 'waiting' ? 'var(--text5)' : color }}
              >
                <Icon
                  name={
                    stage.status === 'done'
                      ? 'check-circle'
                      : stage.status === 'failed'
                        ? 'warning'
                        : running
                          ? 'spinner'
                          : 'box'
                  }
                  size={14}
                />
              </span>
              <span className="w-10 shrink-0 font-mono text-sm font-bold" style={{ color }}>
                {stage.stage}
              </span>
              <span className="min-w-0 flex-1 truncate text-fg-3">{stage.model}</span>
              {bytes && <span className="shrink-0 font-mono text-sm text-fg-4">{bytes}</span>}
              <span className="w-23 shrink-0 text-right text-sm text-fg-4">
                {stage.percent !== null && running
                  ? `${stage.estimated ? '≈' : ''}${Math.round(stage.percent)}%`
                  : (stage.note ?? '') || statusText[stage.status]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const STAGE_ICON: Record<string, IconName> = {
  VAD: 'bolt',
  ASR: 'wave',
  MT: 'globe',
  TTS: 'volume'
}

/** Nhãn khâu (VAD/ASR/MT/TTS) — màu theo khâu nên phần màu vẫn inline. */
function StageTag({ stage, width }: { stage: string; width: string }): JSX.Element {
  return (
    <span
      className={`${width} text-2xs font-bold tracking-[0.5px]`}
      style={{ color: STAGE_COLORS[stage] ?? 'var(--text3)' }}
    >
      {stage}
    </span>
  )
}

function StageIcon({ stage, size = 30 }: { stage: string; size?: number }): JSX.Element {
  const color = STAGE_COLORS[stage] ?? 'var(--text3)'
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-sm"
      style={{ width: size, height: size, background: `${color}1a`, color }}
    >
      <Icon name={STAGE_ICON[stage] ?? 'box'} size={size > 28 ? 16 : 15} />
    </span>
  )
}

/** Một ô chọn của bảng "Tự chọn". Danh sách lựa chọn do service cấp, không chép tay. */
function CustomPicker({
  label,
  value,
  choices,
  disabled,
  onChange
}: {
  label: string
  value: string
  choices: string[]
  disabled: boolean
  onChange: (value: string) => void
}): JSX.Element {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="label-caps">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT}
        style={SELECT_ARROW}
      >
        {/* Giá trị service đang giữ có thể không nằm trong danh sách (model gỡ khỏi
            registry ở bản sau) — thêm nó vào để ô không tự nhảy sang mục khác. */}
        {(choices.includes(value) ? choices : [value, ...choices]).map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Tiêu đề của một tấm trong lưới hai cột. */
function PanelHeader({ children }: { children: ReactNode }): JSX.Element {
  return <div className="border-b border-line bg-surface px-4 py-3.25">{children}</div>
}

// Tên model trên đĩa và tên service báo về không giống nhau: đĩa là tên file/thư mục
// (`ggml-large-v3-turbo-q5_0`, `facebook/nllb-200-distilled-600M`), còn service trả id
// của adapter (`large-v3-turbo-q5_0`, hoặc danh sách voice ngăn bằng dấu phẩy với TTS).
// Chuẩn hoá rồi so chứa nhau; không khớp thì coi như CHƯA nạp — báo thiếu còn hơn báo
// nhầm một model không nằm trong bộ nhớ là đã nạp.
function normalizeModelName(name: string): string {
  const last = name.split('/').pop() ?? name
  return last.replace(/^ggml-/, '').toLowerCase()
}

export function ModelsScreen(): JSX.Element {
  const L = useDict()
  const uiLanguage = useUiStore((s) => s.uiLanguage)
  const compute = useCompute()
  const health = useHealth()
  const config = useServiceConfig()
  const setPreset = useSetPreset()
  const installed = useInstalledModels(health.isSuccess)
  const deleteModels = useDeleteInstalledModels()
  const setSessionConfig = useSessionStore((s) => s.setConfig)
  const active = useSessionStore((s) => s.active)
  const [query, setQuery] = useState('')

  const loadModels = useLoadModels()
  const unloadModels = useUnloadModels()
  const cancelLoad = useCancelLoadModels()
  const downloadModel = useDownloadModel()
  const deleteOneModel = useDeleteInstalledModel()
  const setCustomModels = useSetCustomModels()
  // Bản nháp của ô "Tự chọn": chỉ gửi khi bấm Lưu, nên đổi ô chọn không kéo theo một
  // lượt nạp lại model ngoài ý muốn.
  const [customDraft, setCustomDraft] = useState<{
    asrAdapter?: string
    asrModel?: string
    mtModel?: string
  }>({})
  // Chỉ hỏi tiến trình khi đang nạp; hỏi thêm một nhịp sau khi xong để thanh kịp đầy.
  const loadProgress = useLoadProgress(loadModels.isPending || setPreset.isPending)
  const overallPercent = loadProgress.data?.overallPercent ?? 0

  const current = config.data?.preset ?? null
  const meta = current ? PRESET_META[current] : null
  const stages = config.data?.stages ?? []
  // Service không nạp model lúc khởi động: `stages` rỗng nghĩa là chưa có gì trong RAM.
  const modelsLoaded = stages.length > 0
  const loading = loadModels.isPending || setPreset.isPending
  const busy = loading || unloadModels.isPending || deleteModels.isPending
  const customChoice = config.data?.custom ?? null
  // Tên model đang tải, để chỉ ô đó hiện vòng xoay (service chạy một lượt một lúc).
  const downloadingNow = downloadModel.isPending ? downloadModel.variables : null
  const installedList = installed.data ?? []
  const installedNames = new Set(installedList.map((m) => m.name))
  const totalBytes = installedList.reduce((sum, m) => sum + m.sizeBytes, 0)
  const serviceUp = health.isSuccess

  const loadedModels = stages.filter((s) => s.loaded).map((s) => s.model.toLowerCase())
  const isLoadedOnDisk = (name: string): boolean => {
    const needle = normalizeModelName(name)
    return needle.length > 2 && loadedModels.some((m) => m.includes(needle))
  }

  const applyPreset = (preset: Preset): void => {
    setPreset.mutate(preset, {
      // session.start gửi kèm preset — giữ đồng bộ với cái service vừa nạp.
      onSuccess: (data) => setSessionConfig({ preset: data.preset })
    })
  }

  const clearModels = (): void => {
    if (!window.confirm(L.dirConfirmClear)) return
    deleteModels.mutate()
  }

  // Dải trạng thái lớn đầu màn: bốn trạng thái (service chết / đang nạp / đã nạp /
  // chưa nạp) đổi cả màu viền, icon lẫn nút bên phải. Lúc chưa nạp thì tiêu đề để màu
  // chữ thường — chưa nạp model không phải là một tình trạng bất thường.
  const hero = !serviceUp
    ? {
        icon: 'warning' as IconName,
        color: '#fb923c',
        title: L.mbDownT,
        titleColor: '#fb923c',
        border: 'rgba(251,146,60,.3)',
        bg: 'rgba(251,146,60,.07)',
        body: L.mbDownS
      }
    : loading
      ? {
          icon: 'spinner' as IconName,
          color: '#22d3ee',
          title: setPreset.isPending ? L.applyingPreset : L.mbLoadT,
          titleColor: '#22d3ee',
          border: 'rgba(34,211,238,.3)',
          bg: 'rgba(34,211,238,.07)',
          body: L.mbLoadS
        }
      : modelsLoaded
        ? {
            icon: 'check-circle' as IconName,
            color: '#22c55e',
            title: L.mbReadyT,
            titleColor: 'var(--ac-grn)',
            border: 'rgba(34,197,94,.3)',
            bg: 'rgba(34,197,94,.07)',
            body: L.mbReadyS
          }
        : {
            icon: 'box' as IconName,
            color: 'var(--text3)',
            title: L.mbIdleT,
            titleColor: 'var(--text)',
            border: 'var(--line)',
            bg: 'var(--surface)',
            body: L.mbIdleS
          }

  // Cảnh báo bộ nhớ: deviceMemory bị chặn trần 8 GB nên chỉ cảnh báo mềm khi chạm trần.
  const ramWarning = useMemo(() => {
    if (!meta || !compute?.ramGb) return null
    if (compute.ramCapped) {
      return meta.ramGb > 8
        ? { level: 'warn' as const, text: format(L.ramWarnSoft, { req: meta.ramGb }) }
        : null
    }
    return meta.ramGb > compute.ramGb
      ? {
          level: 'error' as const,
          text: format(L.ramWarnHard, { req: meta.ramGb, have: compute.ramGb })
        }
      : null
  }, [meta, compute, L])

  const catalog = MODEL_CATALOG.filter((entry) =>
    query.trim()
      ? `${entry.name} ${entry.detail} ${entry.stage}`.toLowerCase().includes(query.toLowerCase())
      : true
  )

  return (
    <div className={SCREEN}>
      <ScreenHeader
        icon="box"
        title={L.modelMgr}
        subtitle={L.modelSub}
        color="#a855f7"
        tint="rgba(168,85,247,.12)"
      />

      {/* dải trạng thái lớn */}
      <div
        className="flex flex-wrap items-center gap-4.5 rounded-3xl border px-5.5 py-5 backdrop-blur-xl"
        style={{ borderColor: hero.border, background: hero.bg }}
      >
        <span className="inline-flex size-13 shrink-0 items-center justify-center rounded-xl border border-line bg-surface">
          <span className="flex" style={{ color: hero.color }}>
            <Icon
              name={hero.icon}
              size={20}
              spin={hero.icon === 'spinner'}
              strokeWidth={hero.icon === 'spinner' ? 2.6 : 2.2}
            />
          </span>
        </span>
        <div className="min-w-45 flex-1">
          <div className="text-xl font-extrabold" style={{ color: hero.titleColor }}>
            {hero.title}
          </div>
          <div className="mt-0.75 text-base text-fg-3">{hero.body}</div>
          {loading && (
            <div className="mt-3 flex max-w-105">
              <Meter value={overallPercent / 100} color="#a855f7" to="#6366f1" height={6} />
            </div>
          )}
        </div>

        {serviceUp && (
          <div className="flex items-center gap-2.5">
            {loading ? (
              <>
                <span className="font-mono text-2xl font-extrabold text-[#22d3ee]">
                  {Math.round(overallPercent)}%
                </span>
                {/* Dừng ở ranh giới khâu kế tiếp: khâu đang tải phải tải nốt (không
                    giết ngang được worker thread), nhưng những khâu SAU thì cứu được. */}
                <button
                  disabled={loadProgress.data?.cancelling === true || cancelLoad.isPending}
                  onClick={() => cancelLoad.mutate()}
                  title={L.cancelLoad}
                  className={`${DANGER_BUTTON} inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <Icon name="x" size={12} strokeWidth={2.4} />
                  {loadProgress.data?.cancelling ? L.cancelling : L.cancelLoad}
                </button>
              </>
            ) : modelsLoaded ? (
              <>
                <button
                  className={GHOST_BUTTON}
                  disabled={busy || active}
                  onClick={() => loadModels.mutate(true)}
                >
                  <Icon name="refresh" size={14} />
                  {L.reloadModels}
                </button>
                <button
                  className={GHOST_BUTTON}
                  disabled={busy || active}
                  onClick={() => unloadModels.mutate()}
                >
                  {L.unloadModels}
                </button>
              </>
            ) : (
              <button
                disabled={busy}
                onClick={() => loadModels.mutate(false)}
                className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border-none bg-linear-[135deg,#22d3ee,#3b82f6] px-5.5 text-md font-extrabold text-[#04121a] shadow-[0_6px_20px_rgba(34,211,238,.32)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="play" size={16} />
                {L.startModels}
              </button>
            )}
          </div>
        )}
      </div>

      {setPreset.isError && (
        <Notice
          tone="error"
          icon="warning"
          title={L.presetFailed}
          body={setPreset.error?.message}
        />
      )}
      {loadModels.isError && (
        <Notice tone="error" icon="warning" title={L.loadFailed} body={loadModels.error.message} />
      )}
      {deleteModels.isError && (
        <Notice tone="error" icon="warning" title={L.dirClear} body={deleteModels.error.message} />
      )}

      {/* bộ chọn cấu hình hiệu năng */}
      <div className="panel px-4.5 py-4">
        <div className="label-caps mb-2.75">{L.chooseProfile}</div>
        <div className="grid grid-cols-4 gap-2.25">
          {PRESETS.map((preset) => {
            const p = PRESET_META[preset]
            const on = current === preset
            const disabled = !serviceUp || active || setPreset.isPending
            return (
              <button
                key={preset}
                onClick={() => applyPreset(preset)}
                disabled={disabled}
                title={active ? L.notSupportedYet : undefined}
                className={[
                  'flex items-center gap-2.25 rounded-lg border px-3.25 py-2.75 text-left text-fg transition-all',
                  'disabled:cursor-not-allowed',
                  disabled && !on ? 'opacity-55' : ''
                ].join(' ')}
                // `p.color` có thể là biến CSS (`var(--ac-grn2)`) nên không nối thêm
                // alpha vào được — nền/viền sáng dùng `p.tint` đã là rgba sẵn.
                style={{
                  borderColor: on ? p.color : 'var(--line)',
                  background: on ? p.tint : 'var(--surface)',
                  boxShadow: on ? `0 0 12px ${p.tint}` : undefined
                }}
              >
                <span
                  className="inline-flex size-7.5 shrink-0 items-center justify-center rounded-sm"
                  style={{ background: p.tint, color: p.color }}
                >
                  <Icon name={PRESET_ICON[preset]} size={18} />
                </span>
                <div className="min-w-0">
                  <div className="text-md font-bold">{p.name}</div>
                  <div className="font-mono text-xs text-fg-4">~{p.ramGb} GB RAM</div>
                </div>
              </button>
            )
          })}

          {/* Ô thứ tư: chạy bộ model người dùng tự chọn (bảng chọn ngay bên dưới). */}
          <button
            onClick={() => applyPreset('custom')}
            disabled={!serviceUp || active || setPreset.isPending}
            title={active ? L.notSupportedYet : L.customSub}
            className={[
              'flex items-center gap-2.25 rounded-lg border px-3.25 py-2.75 text-left text-fg transition-all',
              'disabled:cursor-not-allowed',
              !serviceUp || active ? 'opacity-55' : ''
            ].join(' ')}
            style={{
              borderColor: current === 'custom' ? PRESET_META.custom.color : 'var(--line)',
              background: current === 'custom' ? PRESET_META.custom.tint : 'var(--surface)',
              boxShadow: current === 'custom' ? `0 0 12px ${PRESET_META.custom.tint}` : undefined
            }}
          >
            <span
              className="inline-flex size-7.5 shrink-0 items-center justify-center rounded-sm"
              style={{ background: PRESET_META.custom.tint, color: PRESET_META.custom.color }}
            >
              <Icon name="sliders" size={18} />
            </span>
            <div className="min-w-0">
              <div className="text-md font-bold">{L.presetCustom}</div>
              <div className="truncate-1 text-xs text-fg-4">{customChoice?.asrModel ?? '—'}</div>
            </div>
          </button>
        </div>

        {meta && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-surface px-3.25 py-2.5 text-base leading-snug text-fg-3">
            <Dot color={meta.color} glow={false} />
            <span>
              <b className="font-bold text-fg-2">{meta.name}</b> —{' '}
              {uiLanguage === 'vi' ? meta.descVi : meta.descEn}
            </span>
          </div>
        )}

        {/* Bảng chọn model tự chọn — chỉ mở khi đang dùng preset Custom, để ba mức
            dựng sẵn không bị một bảng cấu hình không liên quan chen vào. */}
        {current === 'custom' && customChoice && (
          <div className="mt-3 rounded-lg border border-line bg-surface px-3.25 py-3">
            <div className="grid grid-cols-3 gap-2.5">
              <CustomPicker
                label={L.customAsrAdapter}
                value={customDraft.asrAdapter ?? customChoice.asrAdapter}
                choices={customChoice.asrAdapterChoices}
                disabled={busy || active}
                onChange={(v) => setCustomDraft((d) => ({ ...d, asrAdapter: v }))}
              />
              <CustomPicker
                label={L.customAsrModel}
                value={customDraft.asrModel ?? customChoice.asrModel}
                choices={customChoice.asrModelChoices}
                disabled={busy || active}
                onChange={(v) => setCustomDraft((d) => ({ ...d, asrModel: v }))}
              />
              <CustomPicker
                label={L.customMtModel}
                value={customDraft.mtModel ?? customChoice.mtModel}
                choices={customChoice.mtModelChoices}
                disabled={busy || active}
                onChange={(v) => setCustomDraft((d) => ({ ...d, mtModel: v }))}
              />
            </div>
            <div className="mt-2.5 flex items-center gap-2.5">
              <button
                className={GHOST_BUTTON}
                disabled={busy || active || Object.keys(customDraft).length === 0}
                onClick={() =>
                  setCustomModels.mutate(
                    { preset: 'custom', choice: customDraft },
                    { onSuccess: () => setCustomDraft({}) }
                  )
                }
              >
                {L.customApply}
              </button>
              <span className="text-xs text-fg-5">{L.customNote}</span>
            </div>
            {setCustomModels.isError && (
              <div className="mt-1.5 text-sm text-ac-red">{setCustomModels.error.message}</div>
            )}
          </div>
        )}

        {ramWarning && (
          <div className="mt-2.75">
            <Notice
              tone={ramWarning.level === 'error' ? 'error' : 'warn'}
              icon="warning"
              title={ramWarning.text}
            />
          </div>
        )}
      </div>

      {/* Giữ lại bảng sau khi nạp xong để thấy kết quả; giải phóng model thì bỏ đi
          vì lúc đó nó mô tả một thứ không còn nằm trong bộ nhớ nữa. */}
      {loadProgress.data && loadProgress.data.stages.length > 0 && (busy || modelsLoaded) && (
        <LoadProgressPanel progress={loadProgress.data} L={L} />
      )}

      {/* khâu pipeline — model + thiết bị THẬT do service báo về */}
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-line bg-surface px-4.5 py-3.25">
          <span className="text-base font-bold">{L.installed}</span>
          {meta && <Badge color={meta.color}>{meta.name}</Badge>}
        </div>
        {stages.length > 0 ? (
          stages.map((stage) => (
            <div
              key={stage.stage}
              className="flex items-center gap-3.5 border-b border-line-soft px-4.5 py-3.25"
            >
              <StageIcon stage={stage.stage} />
              <StageTag stage={stage.stage} width="w-11" />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-md font-semibold">{stage.model}</div>
                <div className="text-sm text-fg-4">
                  {L.adapterLbl}: {stage.adapter}
                </div>
              </div>
              <Badge color={STAGE_COLORS[stage.stage] ?? 'var(--text3)'}>{stage.accel}</Badge>
              <span
                className={`inline-flex w-20 items-center justify-end gap-1.5 text-sm font-semibold ${
                  stage.loaded ? 'text-ac-grn' : 'text-fg-4'
                }`}
              >
                {stage.loaded && <Icon name="check" size={14} strokeWidth={2.6} />}
                {stage.loaded ? L.loadedLbl : L.loadIdle}
              </span>
            </div>
          ))
        ) : (
          <div className="px-5 py-8.5 text-center text-base text-fg-5">{L.mbIdleS}</div>
        )}
      </div>

      {/* thư viện model: đã cài trên đĩa | danh mục tra cứu */}
      <div className="grid grid-cols-2 items-start gap-3.5">
        {/* model đã tải trên đĩa — dung lượng thật */}
        <div className="panel overflow-hidden">
          <PanelHeader>
            <div className="flex items-center justify-between gap-3">
              <span className="text-base font-bold">{L.onDisk}</span>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-sm text-fg-4">
                  {installed.data ? formatBytes(totalBytes) : ''}
                </span>
                {totalBytes > 0 && (
                  <button
                    className="inline-flex h-6.5 cursor-pointer items-center gap-1.25 rounded-xs border border-[rgba(239,68,68,.22)] bg-[rgba(239,68,68,.1)] px-2.5 text-xs font-semibold text-[#f87171] disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={busy || active}
                    onClick={clearModels}
                  >
                    <Icon name="trash" size={11} />
                    {L.clearModelsBtn}
                  </button>
                )}
              </div>
            </div>
          </PanelHeader>

          <div className="cs max-h-85 overflow-y-auto">
            {installedList.map((model) => {
              const loaded = isLoadedOnDisk(model.name)
              return (
                <div
                  key={model.path}
                  className="flex items-center gap-2.75 border-b border-line-soft px-4 py-2.75"
                >
                  <StageIcon stage={model.stage} size={28} />
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate-1 font-mono text-base font-semibold"
                      title={model.path}
                    >
                      {model.name}
                    </div>
                    <div className="flex gap-1.75 text-xs text-fg-4">
                      <span
                        className="font-bold"
                        style={{ color: STAGE_COLORS[model.stage] ?? 'var(--text3)' }}
                      >
                        {model.stage}
                      </span>
                      <span>{formatBytes(model.sizeBytes)}</span>
                    </div>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold ${
                      loaded ? 'text-ac-grn' : 'text-fg-4'
                    }`}
                  >
                    {loaded ? (
                      <Icon name="check" size={13} strokeWidth={2.6} />
                    ) : (
                      <Dot color="var(--text5)" size={7} glow={false} />
                    )}
                    {loaded ? L.loadedLbl : L.loadIdle}
                  </span>
                  <button
                    disabled={busy || active}
                    title={L.delOneTip}
                    onClick={() => {
                      if (!window.confirm(L.confirmDeleteOne)) return
                      deleteOneModel.mutate(model.path)
                    }}
                    className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-line bg-transparent text-fg-4 hover:text-[#f87171] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              )
            })}
            {installed.data && installedList.length === 0 && (
              <div className="px-5 py-8.5 text-center text-base leading-relaxed text-fg-5">
                {L.noModelsOnDisk}
              </div>
            )}
          </div>

          {config.data?.modelsDir && (
            <div className="truncate-1 px-4 py-2.5 font-mono text-xs text-fg-5">
              {config.data.modelsDir}
            </div>
          )}
        </div>

        {/* danh mục model: bấm Tải là service tải thật về modelsDir, không nạp vào bộ nhớ */}
        <div className="panel overflow-hidden">
          <PanelHeader>
            <div className="flex items-center gap-2.25">
              <span className="flex text-[#f59e0b]">
                <Icon name="search" size={15} />
              </span>
              <span className="text-base font-bold">{L.browseTitle}</span>
            </div>
            <div className="relative mt-2.75">
              <span className="absolute top-1/2 left-3 flex -translate-y-1/2 text-fg-4">
                <Icon name="search" size={15} />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={L.searchPh}
                className={`${INPUT} pl-9`}
              />
            </div>
          </PanelHeader>

          <div className="cs max-h-76 overflow-y-auto">
            {catalog.length === 0 && (
              <div className="px-5 py-7 text-center text-base text-fg-5">{L.noCatalogResults}</div>
            )}
            {catalog.map((entry) => {
              // Khớp với danh sách trên đĩa thật. Từ khi danh mục dùng đường dẫn
              // thật, tên chỉ còn lệch đúng một chỗ: GGML nằm trên đĩa dưới dạng tên
              // file KHÔNG có đuôi `.bin`. Trước đây so thẳng nên nhãn "đã tải" của
              // mọi mục whisper.cpp không bao giờ sáng dù model có sẵn.
              const onDisk = installedNames.has(entry.name.replace(/\.bin$/, ''))
              // Model MLX chỉ chạy trên Metal của Apple Silicon. Làm mờ (thay vì ẩn)
              // để danh mục vẫn là bảng tra cứu đầy đủ, nhưng người dùng Windows
              // không mất công thử một thứ máy họ không chạy được.
              const usable = !entry.platform || entry.platform === PLATFORM
              return (
                <div
                  key={entry.name}
                  className={`flex items-center gap-2.75 border-b border-line-soft px-4 py-2.75 ${
                    usable ? '' : 'opacity-45'
                  }`}
                  title={usable ? undefined : L.catalogWrongPlatform}
                >
                  <StageIcon stage={entry.stage} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate-1 font-mono text-base font-semibold">{entry.name}</div>
                    <div className="flex gap-1.75 text-xs text-fg-4">
                      <span
                        className="font-bold"
                        style={{ color: STAGE_COLORS[entry.stage] ?? 'var(--text3)' }}
                      >
                        {entry.stage}
                      </span>
                      <span>{entry.size}</span>
                      <span className="truncate-1">{entry.detail}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 justify-end">
                    {onDisk ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ac-grn">
                        <Icon name="check" size={13} strokeWidth={2.4} />
                        {L.dldOk}
                      </span>
                    ) : usable ? (
                      <button
                        className={`${GHOST_BUTTON} h-7 text-sm`}
                        disabled={downloadModel.isPending || busy}
                        onClick={() => downloadModel.mutate(entry.name)}
                      >
                        <Icon
                          name={downloadingNow === entry.name ? 'spinner' : 'download'}
                          size={13}
                          spin={downloadingNow === entry.name}
                        />
                        {downloadingNow === entry.name ? L.dlWorking : L.dlBtn}
                      </button>
                    ) : (
                      <DisabledButton
                        label={L.dlBtn}
                        hint={L.catalogWrongPlatform}
                        icon="download"
                        className="h-7 text-sm"
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
