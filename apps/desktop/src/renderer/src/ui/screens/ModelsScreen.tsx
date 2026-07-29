// Màn Quản lý Model: đổi preset (GET/PUT /api/config) và xem model của preset đang
// chạy. Tải model từ Hugging Face chưa có API bên AI service nên chỉ tra cứu.

import { useMemo, useState, type JSX } from 'react'
import { formatBytes } from '../../application/format'
import { format } from '../../application/i18n'
import { MODEL_CATALOG, PRESET_META, STAGE_COLORS } from '../../application/presets'
import type { Preset } from '../../domain/enums'
import { PRESETS } from '../../domain/models'
import { useInstalledModels, useServiceConfig, useSetPreset } from '../../hooks/use-config'
import { useHealth } from '../../hooks/use-health'
import { useCompute, useDict } from '../../hooks/use-ui'
import { useSessionStore } from '../../stores/session-store'
import { useUiStore } from '../../stores/ui-store'
import { Icon, type IconName } from '../components/Icon'
import { Badge, DisabledButton, Notice, ScreenHeader } from '../components/primitives'
import { inputStyle, LABEL, MONO, PANEL } from '../styles'

const PRESET_ICON: Record<Preset, IconName> = {
  fast: 'bolt',
  balanced: 'scale',
  quality: 'star'
}

const STAGE_ICON: Record<string, IconName> = {
  VAD: 'bolt',
  ASR: 'wave',
  MT: 'globe',
  TTS: 'volume'
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

  const current = config.data?.preset ?? null
  const meta = current ? PRESET_META[current] : null
  const stages = config.data?.stages ?? []
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
    : setPreset.isPending
      ? {
          tone: 'info' as const,
          icon: 'spinner' as IconName,
          title: L.applyingPreset,
          body: L.mbIdleS
        }
      : current
        ? {
            tone: 'ok' as const,
            icon: 'check-circle' as IconName,
            title: L.mbReadyT,
            body: L.mbReadyS
          }
        : { tone: 'info' as const, icon: 'box' as IconName, title: L.mbIdleT, body: L.mbIdleS }

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
    <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScreenHeader
        icon="box"
        title={L.modelMgr}
        subtitle={L.modelSub}
        color="#a855f7"
        tint="rgba(168,85,247,.12)"
      />

      <Notice tone={banner.tone} icon={banner.icon} title={banner.title} body={banner.body} />
      {setPreset.isError && (
        <Notice
          tone="error"
          icon="warning"
          title={L.presetFailed}
          body={setPreset.error?.message}
        />
      )}

      {/* preset */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 14 }}>
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
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                color: 'var(--text)',
                padding: 17,
                borderRadius: 16,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all .18s',
                border: `1px solid ${on ? 'var(--line-strong)' : 'var(--line)'}`,
                background: on ? 'var(--line-soft)' : 'var(--panel)',
                boxShadow: on ? '0 0 20px var(--line-soft)' : 'none',
                opacity: disabled && !on ? 0.55 : 1
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%'
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: p.tint,
                    color: p.color
                  }}
                >
                  <Icon name={PRESET_ICON[preset]} size={18} />
                </span>
                {on && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 9999,
                      background: p.color,
                      color: '#04121a'
                    }}
                  >
                    {L.presetActive}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 12 }}>{p.name}</div>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--text3)',
                  lineHeight: 1.45,
                  marginTop: 5
                }}
              >
                {uiLanguage === 'vi' ? p.descVi : p.descEn}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 14,
                  marginTop: 12,
                  fontSize: 10.5,
                  color: 'var(--text4)',
                  ...MONO
                }}
              >
                <span>~{p.ramGb} GB RAM</span>
              </div>
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

      {/* khâu pipeline — model + thiết bị THẬT do service báo về */}
      <div style={{ ...PANEL, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '13px 18px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--surface)'
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{L.installed}</span>
          {meta && <Badge color={meta.color}>{meta.name}</Badge>}
        </div>
        {stages.length > 0 ? (
          stages.map((stage) => {
            const color = STAGE_COLORS[stage.stage] ?? 'var(--text3)'
            return (
              <div
                key={stage.stage}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '13px 18px',
                  borderBottom: '1px solid var(--line-soft)'
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `${color}1a`,
                    color
                  }}
                >
                  <Icon name={STAGE_ICON[stage.stage] ?? 'box'} size={16} />
                </span>
                <span
                  style={{ width: 44, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color }}
                >
                  {stage.stage}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, ...MONO }}>{stage.model}</div>
                  <div style={{ fontSize: 11, color: 'var(--text4)' }}>
                    {L.adapterLbl}: {stage.adapter}
                  </div>
                </div>
                <Badge color={color}>{stage.accel}</Badge>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    width: 80,
                    justifyContent: 'flex-end',
                    color: stage.loaded ? 'var(--ac-grn)' : 'var(--text4)'
                  }}
                >
                  {stage.loaded && <Icon name="check" size={14} strokeWidth={2.6} />}
                  {stage.loaded ? L.loadedLbl : L.loadIdle}
                </span>
              </div>
            )
          })
        ) : (
          <div
            style={{
              padding: '34px 20px',
              textAlign: 'center',
              color: 'var(--text5)',
              fontSize: 12.5
            }}
          >
            {L.mbIdleS}
          </div>
        )}
      </div>

      {/* model đã tải trên đĩa — dung lượng thật */}
      <div style={{ ...PANEL, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '13px 18px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--surface)'
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{L.onDisk}</span>
          <span style={{ fontSize: 11, color: 'var(--text4)', ...MONO }}>
            {installed.data ? formatBytes(totalBytes) : ''}
          </span>
        </div>
        {(installed.data ?? []).map((model) => {
          const color = STAGE_COLORS[model.stage] ?? 'var(--text3)'
          return (
            <div
              key={model.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                padding: '12px 18px',
                borderBottom: '1px solid var(--line-soft)'
              }}
            >
              <span
                style={{ width: 40, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color }}
              >
                {model.stage}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, ...MONO }}>{model.name}</div>
                <div
                  title={model.path}
                  style={{
                    fontSize: 10.5,
                    color: 'var(--text4)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {model.path}
                </div>
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--text3)', ...MONO }}>
                {formatBytes(model.sizeBytes)}
              </span>
            </div>
          )
        })}
        {installed.data && installed.data.length === 0 && (
          <div
            style={{
              padding: '30px 20px',
              textAlign: 'center',
              color: 'var(--text5)',
              fontSize: 12.5
            }}
          >
            {L.noModelsOnDisk}
          </div>
        )}
        {config.data?.modelsDir && (
          <div
            style={{
              padding: '10px 18px',
              fontSize: 10.5,
              color: 'var(--text5)',
              ...MONO
            }}
          >
            {config.data.modelsDir}
          </div>
        )}
      </div>

      {/* cấu hình tự chọn — cần API model */}
      <div
        style={{
          borderRadius: 16,
          border: '1px dashed var(--line-strong)',
          background: 'var(--surface)',
          padding: '16px 20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ color: '#f472b6', display: 'flex' }}>
            <Icon name="sliders" size={16} />
          </span>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f472b6' }}>{L.customTitle}</div>
          <Badge color="var(--text4)">{L.notSupported}</Badge>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 5 }}>{L.customSub}</div>
      </div>

      {/* danh mục tham khảo */}
      <div style={{ ...PANEL, overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--surface)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ color: '#f59e0b', display: 'flex' }}>
              <Icon name="search" size={16} />
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{L.browseTitle}</span>
            <Badge color="var(--text4)">{L.notSupported}</Badge>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{L.browseSub}</div>
          <div style={{ position: 'relative', marginTop: 12 }}>
            <span
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text4)',
                display: 'flex'
              }}
            >
              <Icon name="search" size={15} />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={L.searchPh}
              style={{ ...inputStyle, paddingLeft: 36 }}
            />
          </div>
        </div>
        <div className="cs" style={{ maxHeight: 280, overflowY: 'auto' }}>
          {catalog.length === 0 && (
            <div
              style={{
                padding: '28px 20px',
                textAlign: 'center',
                color: 'var(--text5)',
                fontSize: 12.5
              }}
            >
              {L.noCatalogResults}
            </div>
          )}
          {catalog.map((entry) => {
            const color = STAGE_COLORS[entry.stage]
            // Khớp với danh sách trên đĩa thật, không khớp với bảng preset chép tay.
            const inUse = [...installedNames].some(
              (name) => name === entry.name || name.endsWith(`/${entry.name}`)
            )
            return (
              <div
                key={entry.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 13,
                  padding: '12px 18px',
                  borderBottom: '1px solid var(--line-soft)'
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `${color}1a`,
                    color
                  }}
                >
                  <Icon name={STAGE_ICON[entry.stage]} size={15} />
                </span>
                <span
                  style={{ width: 40, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color }}
                >
                  {entry.stage}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, ...MONO }}>{entry.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text4)' }}>{entry.detail}</div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text3)',
                    width: 70,
                    textAlign: 'right',
                    ...MONO
                  }}
                >
                  {entry.size}
                </span>
                <div style={{ width: 130, display: 'flex', justifyContent: 'flex-end' }}>
                  {inUse ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--ac-grn)'
                      }}
                    >
                      <Icon name="check" size={14} strokeWidth={2.4} />
                      {L.loadedLbl}
                    </span>
                  ) : (
                    <DisabledButton
                      label={L.dlBtn}
                      hint={L.browseDisabled}
                      icon="download"
                      style={{ height: 30, fontSize: 11.5 }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ ...LABEL, textTransform: 'none', letterSpacing: 0, lineHeight: 1.5 }}>
        {L.notSupportedYet}
      </div>
    </div>
  )
}
