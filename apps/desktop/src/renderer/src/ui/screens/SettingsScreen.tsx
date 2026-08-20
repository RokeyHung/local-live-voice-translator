// Màn Cài đặt: chủ đề, ngôn ngữ giao diện, token Hugging Face và glossary.
// Toàn bộ lưu trong localStorage của máy.

import { useState, type JSX } from 'react'
import { chooseDirectory } from '../../application/config'
import { formatBytes } from '../../application/format'
import type { ThemeMode } from '../../domain/enums'
import {
  useDeleteInstalledModels,
  useServiceConfig,
  useSetHistoryEnabled,
  useSetModelsDir
} from '../../hooks/use-config'
import { useDeleteAllSessions } from '../../hooks/use-history'
import { useCacheBytes, useClearCache, useStorageUsage } from '../../hooks/use-storage'
import { useDict, useIsScreen } from '../../hooks/use-ui'
import { useUiStore } from '../../stores/ui-store'
import { Icon, type IconName } from '../components/Icon'
import { Meter, ScreenHeader, Segmented } from '../components/primitives'
import { GHOST_BUTTON, INPUT, PRIMARY_BUTTON, SCREEN } from '../styles'

/** Một kho dữ liệu trên đĩa: nhãn · thanh tỉ lệ · dung lượng · nút dọn. */
function StorageRow({
  label,
  color,
  bytes,
  total,
  cleanLabel,
  onClean,
  busy,
  emptyLabel
}: {
  label: string
  color: string
  bytes: number
  total: number
  cleanLabel: string
  onClean: () => void
  busy: boolean
  emptyLabel: string
}): JSX.Element {
  // Kho rỗng thì để thanh trống hẳn; kho có dữ liệu nhưng bé quá thì vẫn chừa 2% để
  // nhìn thấy là nó tồn tại.
  const percent = total > 0 && bytes > 0 ? Math.max(2, Math.round((bytes / total) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-base font-semibold text-fg-2">{label}</span>
      <Meter value={percent / 100} color={color} to={color} height={8} />
      <span className="w-18.5 shrink-0 text-right font-mono text-sm text-fg-3">
        {bytes > 0 ? formatBytes(bytes) : emptyLabel}
      </span>
      <div className="flex w-16.5 shrink-0 justify-end">
        <button
          onClick={onClean}
          disabled={bytes === 0 || busy}
          className="inline-flex h-7 cursor-pointer items-center gap-1.25 rounded-sm border border-line-strong bg-surface px-2.75 text-xs font-semibold text-fg-3 transition-colors hover:border-[rgba(239,68,68,.4)] hover:text-[#f87171] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-fg-3"
        >
          <Icon name="trash" size={12} />
          {cleanLabel}
        </button>
      </div>
    </div>
  )
}

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
    <div className="panel px-5 py-4.5">
      <div className="mb-1 flex items-center gap-2.5">
        <span className="flex" style={{ color }}>
          <Icon name={icon} size={16} />
        </span>
        <div className="text-md font-bold">{title}</div>
        {right}
      </div>
      <div className="mb-3.5 text-base text-fg-3">{desc}</div>
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

  // Lưu lịch sử + thư mục model là cấu hình của service (nó mới là nơi ghi đĩa).
  const config = useServiceConfig()
  const setHistoryEnabled = useSetHistoryEnabled()
  const setModelsDir = useSetModelsDir()
  const deleteModels = useDeleteInstalledModels()

  // Dung lượng đĩa: model + lịch sử do service đo (nó mới là bên ghi đĩa), cache là
  // của chính Electron. Chỉ hỏi khi đang mở màn này — quét thư mục model là rglob
  // trên vài GB, không nên chạy nền.
  const visible = useIsScreen('settings')
  const storage = useStorageUsage(visible)
  const cache = useCacheBytes(visible)
  const clearCache = useClearCache()
  const deleteSessions = useDeleteAllSessions()

  const serverDir = config.data?.modelsDir ?? ''
  const dirEditable = config.data?.modelsDirEditable !== false
  // null = đang bám theo giá trị thật của service; chuỗi = người dùng đang sửa dở.
  const [dirDraft, setDirDraft] = useState<string | null>(null)
  const dirValue = dirDraft ?? serverDir

  const sizeOf = (key: string): number =>
    (storage.data?.items ?? []).find((item) => item.key === key)?.sizeBytes ?? 0
  const cacheUsed = cache.data ?? 0
  const usedBytes = (storage.data?.totalBytes ?? 0) + cacheUsed
  const dirDirty = dirValue.trim() !== '' && dirValue.trim() !== serverDir

  const applyDir = (dir: string): void => {
    const preset = config.data?.preset
    const clean = dir.trim()
    if (!preset || !clean || clean === serverDir) return
    setModelsDir.mutate({ preset, dir: clean }, { onSuccess: () => setDirDraft(null) })
  }

  const browseDir = async (): Promise<void> => {
    const picked = await chooseDirectory(serverDir || undefined)
    if (!picked) return // người dùng bấm Huỷ
    setDirDraft(picked)
    applyDir(picked)
  }

  const clearModels = (): void => {
    if (!window.confirm(L.dirConfirmClear)) return
    deleteModels.mutate()
  }

  const clearHistory = (): void => {
    if (!window.confirm(L.confirmClearHistory)) return
    deleteSessions.mutate()
  }

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
    <div className={`${SCREEN} max-w-190`}>
      <ScreenHeader
        icon="gear"
        title={L.settings}
        subtitle={L.settingsSub}
        color="#38bdf8"
        tint="rgba(56,189,248,.12)"
      />

      <Section icon="sun" color="var(--ac-sky)" title={L.appearance} desc={L.themeDesc}>
        <div className="grid grid-cols-3 gap-2.5">
          {themeCards.map((card) => {
            const on = theme === card.mode
            return (
              <button
                key={card.mode}
                onClick={() => setTheme(card.mode)}
                className={[
                  'flex cursor-pointer flex-col items-center rounded-[13px] border px-3 py-4 text-center transition-all',
                  on
                    ? 'border-[rgba(125,211,252,.5)] bg-[rgba(125,211,252,.1)] text-ac-sky-2 shadow-[0_0_16px_rgba(125,211,252,.14)]'
                    : 'border-line bg-surface text-fg-2 hover:border-line-strong'
                ].join(' ')}
              >
                <span className={`flex ${on ? 'text-ac-sky' : 'text-fg-3'}`}>
                  <Icon name={card.icon} size={20} />
                </span>
                <span className="mt-2.25 text-md font-bold">{card.label}</span>
                <span className="mt-0.75 text-xs text-fg-3">{card.sub}</span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section icon="globe" color="#22d3ee" title={L.uiLang} desc={L.langDesc}>
        <div className="max-w-70">
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

      <Section
        icon="folder"
        color="#fb923c"
        title={L.dirTitle}
        desc={L.dirDesc}
        right={
          storage.data ? (
            <span className="font-mono text-xs text-fg-4">
              {L.dirUsed}: {formatBytes(usedBytes)}
            </span>
          ) : undefined
        }
      >
        <div>
          <div className="flex flex-wrap gap-2">
            <input
              value={dirValue}
              disabled={!dirEditable}
              onChange={(e) => setDirDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyDir(dirValue)}
              onBlur={() => applyDir(dirValue)}
              placeholder={L.dirPh}
              className={`${INPUT} min-w-60 flex-1 font-mono disabled:cursor-not-allowed disabled:opacity-60`}
            />
            {dirDirty && (
              <button
                className={PRIMARY_BUTTON}
                disabled={setModelsDir.isPending}
                onClick={() => applyDir(dirValue)}
              >
                {L.dirApply}
              </button>
            )}
            <button
              className={`${GHOST_BUTTON} hover:border-[#fb923c] hover:text-ac-org`}
              disabled={!dirEditable || setModelsDir.isPending}
              onClick={() => void browseDir()}
            >
              <Icon name="folder" size={15} />
              {L.dirBrowse}
            </button>
          </div>

          {/* Phân rã dung lượng. Ba kho này là TẤT CẢ những gì app ghi ra đĩa; con số
              đều đo thật (service rglob thư mục model + stat file SQLite, cache lấy từ
              chính Chromium). Thiết kế còn có dòng "Log" nhưng app không ghi file log
              nào nên không dựng một dòng luôn bằng 0. */}
          <div className="mt-4 flex flex-col gap-2.25">
            <StorageRow
              label={L.stModels}
              color="#a855f7"
              bytes={sizeOf('models')}
              total={usedBytes}
              cleanLabel={L.cleanBtn}
              onClean={clearModels}
              busy={deleteModels.isPending}
              emptyLabel={L.emptyDir}
            />
            <StorageRow
              label={L.stHistory}
              color="#d946ef"
              bytes={sizeOf('history')}
              total={usedBytes}
              cleanLabel={L.cleanBtn}
              onClean={clearHistory}
              busy={deleteSessions.isPending}
              emptyLabel={L.emptyDir}
            />
            <StorageRow
              label={L.stCache}
              color="#22d3ee"
              bytes={cacheUsed}
              total={usedBytes}
              cleanLabel={L.cleanBtn}
              onClean={() => clearCache.mutate()}
              busy={clearCache.isPending}
              emptyLabel={L.emptyDir}
            />
          </div>

          <div className="mt-3 text-sm text-fg-4">{L.cleanHint}</div>
          <div className="mt-1 text-xs leading-normal text-fg-5">{L.cleanNoLogs}</div>
          <div className="mt-2.5 text-sm text-fg-4">{dirEditable ? L.dirNote : L.dirLocked}</div>
          {setModelsDir.isError && (
            <div className="mt-1 text-sm text-ac-red">{setModelsDir.error.message}</div>
          )}
          {deleteModels.isError && (
            <div className="mt-1 text-sm text-ac-red">{deleteModels.error.message}</div>
          )}
          {deleteSessions.isError && (
            <div className="mt-1 text-sm text-ac-red">{deleteSessions.error.message}</div>
          )}
          {deleteModels.isSuccess && (
            <div className="mt-1 text-sm text-fg-4">
              {deleteModels.data.removed.length === 0
                ? L.dirNothingToClear
                : `${L.dirCleared} ${formatBytes(deleteModels.data.freedBytes)}.`}
            </div>
          )}
        </div>
      </Section>

      <Section icon="shield" color="#22c55e" title={L.privacyT} desc={L.privacyDesc}>
        <div>
          <div className="max-w-70">
            <Segmented
              size="lg"
              value={config.data?.historyEnabled === false ? 'off' : 'on'}
              onChange={(value) => {
                const preset = config.data?.preset
                if (!preset) return
                setHistoryEnabled.mutate({ preset, enabled: value === 'on' })
              }}
              options={[
                { value: 'on', label: L.historyOn },
                { value: 'off', label: L.historyOff }
              ]}
            />
          </div>
          <div className="mt-2.5 text-sm text-fg-4">
            {config.data ? (
              <>
                {L.historyPath}{' '}
                <span className="font-mono text-fg-3">{config.data.historyDbPath}</span>
              </>
            ) : (
              L.historyPathUnknown
            )}
          </div>
          <div className="mt-1 text-sm text-fg-4">{L.historyOffNote}</div>
        </div>
      </Section>

      <Section icon="file" color="#f59e0b" title={L.hfTitle} desc={L.hfDesc}>
        <div>
          <input
            type="password"
            value={hfToken}
            onChange={(e) => setHfToken(e.target.value)}
            placeholder={L.hfPh}
            className={`${INPUT} max-w-105 font-mono`}
          />
          <div className="mt-2 text-sm text-fg-4">{L.hfUnused}</div>
        </div>
      </Section>

      <Section
        icon="book"
        color="var(--ac-mag)"
        title={L.glossTitle}
        desc={L.glossDesc}
        right={
          glossary.length > 0 ? (
            <span className="font-mono text-xs text-fg-4">
              {glossary.length} {L.glossCount}
            </span>
          ) : undefined
        }
      >
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitTerm()}
              placeholder={L.glossSrcPh}
              className={`${INPUT} h-9 min-w-37.5 flex-1`}
            />
            <span className="flex self-center text-fg-4">
              <Icon name="arrow-right" size={16} />
            </span>
            <input
              value={dst}
              onChange={(e) => setDst(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitTerm()}
              placeholder={L.glossDstPh}
              className={`${INPUT} h-9 min-w-37.5 flex-1`}
            />
            <button onClick={submitTerm} className={PRIMARY_BUTTON}>
              {L.glossAdd}
            </button>
          </div>

          {glossary.length === 0 ? (
            <div className="text-sm text-fg-5">{L.glossEmpty}</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {glossary.map((entry) => (
                <span
                  key={entry.id}
                  className="inline-flex items-center gap-2 rounded-[9px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm"
                >
                  <span className="font-mono text-fg-3">{entry.source}</span>
                  <Icon name="arrow-right" size={12} strokeWidth={2.4} />
                  <span className="font-mono font-semibold">{entry.target}</span>
                  <button
                    onClick={() => removeGlossary(entry.id)}
                    aria-label={`${L.clear} ${entry.source}`}
                    className="flex size-4.5 cursor-pointer items-center justify-center rounded-[5px] border-none bg-transparent text-fg-4 transition-colors hover:text-[#f87171]"
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
