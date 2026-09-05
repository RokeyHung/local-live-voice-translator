// Màn Đánh giá: chạy bộ câu mẫu qua hệ thống và tự chấm điểm.
//
// GVHD giao ở biên bản 19/08 mục 3d — chọn câu mẫu CÓ bản dịch tham chiếu, chạy qua
// hệ thống, app tự tính độ trễ và chất lượng. Trước đây chỉ có bản CLI
// (`make accuracy`), phải mở terminal mới xem được số.
//
// Hai chỗ màn này phải nói thật, không được để người đọc hiểu nhầm:
//
// 1. Câu không có bản ghi giọng thật sẽ chạy bằng giọng TỔNG HỢP (máy tự đọc rồi tự
//    nghe lại). Số khi đó lạc quan hơn thực tế, nên có dải cảnh báo riêng.
// 2. Số ở đây KHÔNG thay thế `make eval-asr` / `make eval-mt`: bộ script đó dùng
//    jiwer + spBLEU nên so được với số công bố của NLLB-200. Màn này để thử nhanh và
//    so các cấu hình với nhau.

import { useMemo, useState, type JSX } from 'react'
import { format } from '../../application/i18n'
import type { EvaluationCase, EvaluationResult } from '../../domain/models'
import { useServiceConfig } from '../../hooks/use-config'
import {
  useCancelEvaluation,
  useEvaluationCorpus,
  useEvaluationProgress,
  useRunEvaluation
} from '../../hooks/use-evaluate'
import { useHealth } from '../../hooks/use-health'
import { useDict, useIsScreen } from '../../hooks/use-ui'
import { useSessionStore } from '../../stores/session-store'
import { Icon } from '../components/Icon'
import { Meter, Notice, ScreenHeader } from '../components/primitives'
import { DANGER_BUTTON, GHOST_BUTTON, PRIMARY_BUTTON, SCREEN } from '../styles'

/** Một ô số trong bảng tổng. `tone` chỉ để tô màu, không đổi ý nghĩa con số. */
function Stat({
  label,
  value,
  hint,
  color = 'var(--text)'
}: {
  label: string
  value: string
  hint?: string
  color?: string
}): JSX.Element {
  return (
    <div className="rounded-lg border border-line bg-surface px-3.5 py-3">
      <div className="label-caps">{label}</div>
      <div className="mt-1 font-mono text-xl font-extrabold" style={{ color }}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-fg-5">{hint}</div>}
    </div>
  )
}

/** Tỉ lệ lỗi: thấp là tốt, nên thang màu ngược với chrF. */
function errorColor(rate: number): string {
  if (rate <= 0.1) return 'var(--ac-grn)'
  if (rate <= 0.25) return '#fbbf24'
  return '#f87171'
}

function scoreColor(score: number): string {
  if (score >= 0.7) return 'var(--ac-grn)'
  if (score >= 0.45) return '#fbbf24'
  return '#f87171'
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function EvaluateScreen(): JSX.Element {
  const L = useDict()
  const health = useHealth()
  const config = useServiceConfig()
  const sessionActive = useSessionStore((s) => s.active)
  const visible = useIsScreen('evaluate')

  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [cases, setCases] = useState<EvaluationCase[] | null>(null)
  const [quick, setQuick] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Bộ câu mẫu chỉ hỏi khi đang mở màn này (màn ẩn vẫn chạy hook — xem CLAUDE.md).
  const corpus = useEvaluationCorpus(visible && health.isSuccess)
  const run = useRunEvaluation()
  const cancel = useCancelEvaluation()
  const progress = useEvaluationProgress(run.isPending)

  // Bộ đang chọn: file người dùng nạp vào, không thì bộ mẫu của service. Bọc useMemo
  // để nó giữ nguyên tham chiếu giữa các lần render (không thì `bySource` tính lại
  // mỗi lần, và mỗi nhịp hỏi tiến trình là một lần render).
  const active = useMemo(() => cases ?? corpus.data ?? [], [cases, corpus.data])
  const serviceUp = health.isSuccess
  // Phiên dịch đang chạy dùng chung model — chen vào sẽ làm phụ đề đứng hình.
  const blocked = !serviceUp || sessionActive
  const limit = quick ? 3 : undefined

  const bySource = useMemo(() => {
    const recorded = active.filter((c) => c.audio).length
    return { recorded, synthetic: active.length - recorded }
  }, [active])

  /** Nạp bộ câu riêng từ file JSON — chỗ số liệu bắt đầu có giá trị thật. */
  const loadFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setLoadError(null)
    try {
      const parsed = JSON.parse(await file.text()) as { cases?: EvaluationCase[] }
      const list = Array.isArray(parsed) ? (parsed as EvaluationCase[]) : (parsed.cases ?? [])
      if (list.length === 0) throw new Error(L.evalEmptyFile)
      setCases(
        list.map((c) => ({
          id: String(c.id ?? ''),
          language: c.language,
          target: c.target,
          transcript: String(c.transcript ?? ''),
          translation: String(c.translation ?? ''),
          audio: String(c.audio ?? '')
        }))
      )
      setResult(null)
    } catch (error) {
      setLoadError((error as Error).message)
    }
  }

  return (
    <div className={SCREEN}>
      <ScreenHeader
        icon="scale"
        title={L.evaluate}
        subtitle={L.evalSub}
        color="#4ade80"
        tint="rgba(74,222,128,.12)"
      />

      {!serviceUp && <Notice tone="warn" icon="warning" title={L.mbDownT} body={L.mbDownS} />}
      {sessionActive && <Notice tone="warn" icon="warning" title={L.impBusySession} />}
      {loadError && <Notice tone="error" icon="warning" title={L.evalBadFile} body={loadError} />}
      {run.isError && (
        <Notice tone="error" icon="warning" title={L.evalFailed} body={run.error.message} />
      )}

      {/* bộ câu + nút chạy */}
      <div className="panel px-4.5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-fg-2">
              {cases ? L.evalCustomSet : L.evalBundledSet}
            </div>
            <div className="mt-0.5 text-sm text-fg-4">
              {format(L.evalSetSummary, {
                n: active.length,
                recorded: bySource.recorded,
                synthetic: bySource.synthetic
              })}
            </div>
          </div>

          <label className={`${GHOST_BUTTON} cursor-pointer`}>
            <Icon name="upload" size={13} />
            {L.evalPickFile}
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void loadFile(e.target.files?.[0])
                e.target.value = '' // chọn lại đúng file đó vẫn phải kích hoạt
              }}
            />
          </label>
          {cases && (
            <button className={GHOST_BUTTON} onClick={() => setCases(null)}>
              {L.evalUseBundled}
            </button>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-base text-fg-3">
            <input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} />
            {L.evalQuick}
          </label>

          {run.isPending ? (
            <button
              className={DANGER_BUTTON}
              disabled={progress.data?.cancelling === true}
              onClick={() => cancel.mutate()}
            >
              <Icon name="x" size={12} strokeWidth={2.4} />
              {progress.data?.cancelling ? L.cancelling : L.cancelBtn}
            </button>
          ) : (
            <button
              className={PRIMARY_BUTTON}
              disabled={blocked || active.length === 0}
              onClick={() =>
                run.mutate({ cases: active, limit }, { onSuccess: (data) => setResult(data) })
              }
            >
              <Icon name="play" size={14} />
              {L.evalRun}
            </button>
          )}
        </div>

        {run.isPending && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm text-fg-3">
              <span>
                {progress.data?.currentCase
                  ? format(L.evalRunning, { id: progress.data.currentCase })
                  : L.mbLoadT}
              </span>
              <span className="font-mono">
                {progress.data ? `${progress.data.done}/${progress.data.total}` : ''}
              </span>
            </div>
            <div className="mt-1.5 flex">
              <Meter value={(progress.data?.percent ?? 0) / 100} color="#4ade80" height={6} />
            </div>
          </div>
        )}

        <div className="mt-2.5 text-xs leading-snug text-fg-5">
          {L.evalScriptNote}
          {config.data?.preset && ` · ${L.presetActive}: ${config.data.preset}`}
        </div>
      </div>

      {result && (
        <>
          {/* Số của giọng tổng hợp lạc quan hơn thực tế — phải nói trước khi người đọc
              kịp chép con số vào báo cáo. */}
          {result.hasSyntheticAudio && (
            <Notice tone="warn" icon="warning" title={L.evalSyntheticT} body={L.evalSyntheticB} />
          )}
          {result.cancelled && <Notice tone="info" icon="info" title={L.evalCancelledNote} />}

          <div className="grid grid-cols-3 gap-2.5 md:grid-cols-6">
            <Stat
              label={result.cases[0]?.metric ?? 'WER'}
              value={percent(result.errorRate)}
              hint={L.evalLowerBetter}
              color={errorColor(result.errorRate)}
            />
            <Stat
              label="chrF"
              value={percent(result.chrf)}
              hint={L.evalHigherBetter}
              color={scoreColor(result.chrf)}
            />
            <Stat label={L.evalAsrP50} value={`${result.asrP50Ms} ms`} />
            <Stat label={L.evalAsrP90} value={`${result.asrP90Ms} ms`} />
            <Stat label={L.evalMtP90} value={`${result.mtP90Ms} ms`} />
            <Stat
              label={L.evalRtfP90}
              value={result.rtfP90.toFixed(3)}
              hint={result.rtfP90 < 1 ? L.evalRtfOk : L.evalRtfSlow}
              color={result.rtfP90 < 1 ? 'var(--ac-grn)' : '#f87171'}
            />
          </div>

          {/* bảng từng câu */}
          <div className="panel overflow-hidden">
            <div className="cs max-h-120 overflow-y-auto">
              {result.cases.map((c) => (
                <div key={c.id} className="border-b border-line-soft px-4.5 py-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-fg-2">{c.id}</span>
                    <span className="font-mono text-xs text-fg-4">
                      {c.language} → {c.target}
                    </span>
                    {c.audioSource === 'tts-roundtrip' && (
                      <span className="rounded-full bg-[rgba(251,191,36,.14)] px-1.75 py-0.5 text-3xs font-bold text-[#fbbf24]">
                        {L.evalSyntheticBadge}
                      </span>
                    )}
                    <span
                      className="ml-auto font-mono text-sm"
                      style={{ color: errorColor(c.errorRate) }}
                    >
                      {c.metric} {percent(c.errorRate)}
                    </span>
                    <span className="font-mono text-sm" style={{ color: scoreColor(c.chrf) }}>
                      chrF {percent(c.chrf)}
                    </span>
                    <span className="font-mono text-xs text-fg-4">
                      {c.asrMs}+{c.mtMs} ms
                    </span>
                  </div>
                  <div className="mt-1.5 grid gap-1 text-base leading-snug md:grid-cols-2">
                    <div>
                      <div className="text-fg-4">{c.reference}</div>
                      <div className="text-fg-2">{c.hypothesis || '—'}</div>
                    </div>
                    <div>
                      <div className="text-fg-4">{c.referenceTranslation}</div>
                      <div className="text-fg-2">{c.translation || '—'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
