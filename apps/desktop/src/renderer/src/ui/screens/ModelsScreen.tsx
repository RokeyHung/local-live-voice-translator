// Màn Quản lý Model: đổi preset (GET/PUT /api/config), xem khâu pipeline đang chạy
// và model đã tải trên đĩa. Tải model từ Hugging Face chưa có API nên chỉ tra cứu.

import { useMemo, useState, type JSX } from 'react'
import { formatBytes } from '../../application/format'
import { format, type Dict } from '../../application/i18n'
import { MODEL_CATALOG, PRESET_META, STAGE_COLORS } from '../../application/presets'
import type { Preset } from '../../domain/enums'
import { PRESETS, type LoadProgress, type LoadStageStatus } from '../../domain/models'
import {
  useInstalledModels,
  useLoadModels,
  useLoadProgress,
  useServiceConfig,
  useSetPreset,
  useUnloadModels
} from '../../hooks/use-config'
import { useHealth } from '../../hooks/use-health'
import { useCompute, useDict } from '../../hooks/use-ui'
import { useSessionStore } from '../../stores/session-store'
import { useUiStore } from '../../stores/ui-store'
import { Icon, type IconName } from '../components/Icon'
import { Badge, DisabledButton, Meter, Notice, ScreenHeader } from '../components/primitives'
import { GHOST_BUTTON, INPUT, PRIMARY_BUTTON, SCREEN } from '../styles'

const PRESET_ICON: Record<Preset, IconName> = {
  fast: 'bolt',
  balanced: 'scale',
  quality: 'star'
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
    failed: L.lpFailed
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

function StageIcon({ stage }: { stage: string }): JSX.Element {
  const color = STAGE_COLORS[stage] ?? 'var(--text3)'
  return (
    <span
      className="flex size-7.5 shrink-0 items-center justify-center rounded-sm"
      style={{ background: `${color}1a`, color }}
    >
      <Icon name={STAGE_ICON[stage] ?? 'box'} size={16} />
    </span>
  )
}

export function ModelsScreen(): JSX.Element {
  const L = useDict()
  const uiLanguage = useUiStore((s) => s.uiLanguage)
  const compute = useCompute()
  const health = useHealth()
  const config = useServiceConfig()
  const setPreset = useSetPreset()
  const installed = useInstalledModels(health.isSuccess)
  const setSessionConfig = useSessionStore((s) => s.setConfig)
  const active = useSessionStore((s) => s.active)
  const [query, setQuery] = useState('')

  const loadModels = useLoadModels()
  const unloadModels = useUnloadModels()
  // Chỉ hỏi tiến trình khi đang nạp; hỏi thêm một nhịp sau khi xong để thanh kịp đầy.
  const loadProgress = useLoadProgress(loadModels.isPending || setPreset.isPending)
  const overallPercent = loadProgress.data?.overallPercent ?? 0

  const current = config.data?.preset ?? null
  const meta = current ? PRESET_META[current] : null
  const stages = config.data?.stages ?? []
  // Service không nạp model lúc khởi động: `stages` rỗng nghĩa là chưa có gì trong RAM.
  const modelsLoaded = stages.length > 0
  const loading = loadModels.isPending || setPreset.isPending
  const busy = loading || unloadModels.isPending
  const installedNames = new Set((installed.data ?? []).map((m) => m.name))
  const totalBytes = (installed.data ?? []).reduce((sum, m) => sum + m.sizeBytes, 0)
  const serviceUp = health.isSuccess

  const applyPreset = (preset: Preset): void => {
    setPreset.mutate(preset, {
      // session.start gửi kèm preset — giữ đồng bộ với cái service vừa nạp.
      onSuccess: (data) => setSessionConfig({ preset: data.preset })
    })
  }

  const banner = !serviceUp
    ? { tone: 'warn' as const, icon: 'warning' as IconName, title: L.mbDownT, body: L.mbDownS }
    : loading
      ? {
          tone: 'info' as const,
          icon: 'spinner' as IconName,
          title: setPreset.isPending ? L.applyingPreset : L.mbLoadT,
          body: L.mbLoadS
        }
      : modelsLoaded
        ? {
            tone: 'ok' as const,
            icon: 'check-circle' as IconName,
            title: L.mbReadyT,
            body: L.mbReadyS
          }
        : { tone: 'info' as const, icon: 'box' as IconName, title: L.mbIdleT, body: L.mbIdleS }

  // Bên phải dải trạng thái: đang nạp → phần trăm tổng (bảng tiến trình ở dưới nói rõ
  // từng khâu); chưa nạp → khởi động; đã nạp → nạp lại + giải phóng.
  const bannerAction = !serviceUp ? null : loading ? (
    <span className="font-mono text-[14px] font-bold text-[#22d3ee]">
      {Math.round(overallPercent)}%
    </span>
  ) : modelsLoaded ? (
    <div className="flex gap-2">
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
    </div>
  ) : (
    <button className={PRIMARY_BUTTON} disabled={busy} onClick={() => loadModels.mutate(false)}>
      <Icon name="play" size={14} />
      {L.startModels}
    </button>
  )

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

      <Notice
        tone={banner.tone}
        icon={banner.icon}
        title={banner.title}
        body={banner.body}
        right={bannerAction}
      />
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

      {/* preset */}
      <div className="grid grid-cols-3 gap-3.5">
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
                'flex flex-col items-start rounded-2xl border p-4.25 text-left text-fg transition-all',
                'disabled:cursor-not-allowed',
                on
                  ? 'border-line-strong bg-line-soft shadow-[0_0_20px_var(--line-soft)]'
                  : 'border-line bg-(image:--panel) backdrop-blur-xl hover:border-line-strong',
                disabled && !on ? 'opacity-55' : ''
              ].join(' ')}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className="flex size-9 items-center justify-center rounded-md"
                  style={{ background: p.tint, color: p.color }}
                >
                  <Icon name={PRESET_ICON[preset]} size={18} />
                </span>
                {on && (
                  <span
                    className="rounded-full px-2 py-0.75 text-xs font-bold text-[#04121a]"
                    style={{ background: p.color }}
                  >
                    {L.presetActive}
                  </span>
                )}
              </div>
              <div className="mt-3 text-lg font-extrabold">{p.name}</div>
              <div className="mt-1.25 text-sm leading-snug text-fg-3">
                {uiLanguage === 'vi' ? p.descVi : p.descEn}
              </div>
              <div className="mt-3 font-mono text-xs text-fg-4">~{p.ramGb} GB RAM</div>
            </button>
          )
        })}
      </div>

      {ramWarning && (
        <Notice
          tone={ramWarning.level === 'error' ? 'error' : 'warn'}
          icon="warning"
          title={ramWarning.text}
        />
      )}

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

      {/* model đã tải trên đĩa — dung lượng thật */}
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4.5 py-3.25">
          <span className="text-base font-bold">{L.onDisk}</span>
          <span className="font-mono text-sm text-fg-4">
            {installed.data ? formatBytes(totalBytes) : ''}
          </span>
        </div>
        {(installed.data ?? []).map((model) => (
          <div
            key={model.path}
            className="flex items-center gap-3.25 border-b border-line-soft px-4.5 py-3"
          >
            <StageTag stage={model.stage} width="w-10" />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-base font-semibold">{model.name}</div>
              <div className="truncate-1 text-xs text-fg-4" title={model.path}>
                {model.path}
              </div>
            </div>
            <span className="font-mono text-sm text-fg-3">{formatBytes(model.sizeBytes)}</span>
          </div>
        ))}
        {installed.data && installed.data.length === 0 && (
          <div className="px-5 py-7.5 text-center text-base text-fg-5">{L.noModelsOnDisk}</div>
        )}
        {config.data?.modelsDir && (
          <div className="px-4.5 py-2.5 font-mono text-xs text-fg-5">{config.data.modelsDir}</div>
        )}
      </div>

      {/* cấu hình tự chọn — cần API model */}
      <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-5 py-4">
        <div className="flex items-center gap-2.25">
          <span className="flex text-[#f472b6]">
            <Icon name="sliders" size={16} />
          </span>
          <div className="text-md font-bold text-[#f472b6]">{L.customTitle}</div>
          <Badge color="var(--text4)">{L.notSupported}</Badge>
        </div>
        <div className="mt-1.25 text-sm text-fg-3">{L.customSub}</div>
      </div>

      {/* danh mục tham khảo */}
      <div className="panel overflow-hidden">
        <div className="border-b border-line bg-surface px-4.5 py-3.5">
          <div className="flex items-center gap-2.25">
            <span className="flex text-[#f59e0b]">
              <Icon name="search" size={16} />
            </span>
            <span className="text-base font-bold">{L.browseTitle}</span>
            <Badge color="var(--text4)">{L.notSupported}</Badge>
          </div>
          <div className="mt-0.75 text-sm text-fg-3">{L.browseSub}</div>
          <div className="relative mt-3">
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
        </div>
        <div className="cs max-h-70 overflow-y-auto">
          {catalog.length === 0 && (
            <div className="px-5 py-7 text-center text-base text-fg-5">{L.noCatalogResults}</div>
          )}
          {catalog.map((entry) => {
            // Khớp với danh sách trên đĩa thật, không khớp với bảng chép tay.
            const inUse = [...installedNames].some(
              (name) => name === entry.name || name.endsWith(`/${entry.name}`)
            )
            return (
              <div
                key={entry.name}
                className="flex items-center gap-3.25 border-b border-line-soft px-4.5 py-3"
              >
                <StageIcon stage={entry.stage} />
                <StageTag stage={entry.stage} width="w-10" />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-base font-semibold">{entry.name}</div>
                  <div className="text-xs text-fg-4">{entry.detail}</div>
                </div>
                <span className="w-17.5 text-right font-mono text-sm text-fg-3">{entry.size}</span>
                <div className="flex w-32 justify-end">
                  {inUse ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ac-grn">
                      <Icon name="check" size={14} strokeWidth={2.4} />
                      {L.loadedLbl}
                    </span>
                  ) : (
                    <DisabledButton
                      label={L.dlBtn}
                      hint={L.browseDisabled}
                      icon="download"
                      className="h-7.5 text-sm"
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="text-xs leading-normal text-fg-4">{L.notSupportedYet}</div>
    </div>
  )
}
