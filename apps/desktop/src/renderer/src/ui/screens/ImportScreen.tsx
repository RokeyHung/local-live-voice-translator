// Màn Nhập tệp: chuyển tệp âm thanh có sẵn thành văn bản (+ bản dịch).
//
// Bố cục theo đúng bản thiết kế: vùng kéo-thả, rồi một "hàng đợi xử lý" một cột,
// mỗi tệp tự mở bản ghi ngay trong dòng của mình khi chạy xong.
//
// Tệp được giải mã ngay tại renderer bằng Web Audio của Chromium rồi gửi lên AI
// service dưới dạng PCM 16 kHz mono (POST /api/transcribe) — không có bước nào ra
// khỏi máy. Các tệp chạy LẦN LƯỢT: service chỉ nhận một tệp một lúc (model dùng
// chung, chạy song song chỉ làm chậm cả hai).
//
// Nút "Phân biệt người nói" của thiết kế giữ nguyên chỗ nhưng ở trạng thái tắt:
// pipeline không có khâu diarization, và bịa ra tên người nói thì tệ hơn là không có.

import { useEffect, useRef, useState, type DragEvent, type JSX } from 'react'
import { decodeMediaAudio, isVideoFile, MediaDecodeError } from '../../adapters/media-decode'
import { downloadText, transcriptToSrt, transcriptToTxt } from '../../application/export'
import { formatBytes, formatDuration } from '../../application/format'
import { languageName, type Dict } from '../../application/i18n'
import type { Language } from '../../domain/enums'
import { LANGUAGES, type TranscriptionResult } from '../../domain/models'
import { useServiceConfig } from '../../hooks/use-config'
import { useHealth } from '../../hooks/use-health'
import {
  useCancelTranscribe,
  useTranscribeFile,
  useTranscribeProgress
} from '../../hooks/use-import'
import { useDict } from '../../hooks/use-ui'
import { useSessionStore } from '../../stores/session-store'
import { useUiStore } from '../../stores/ui-store'
import { Icon, type IconName } from '../components/Icon'
import { DisabledButton, Meter, Notice, ScreenHeader, Segmented } from '../components/primitives'
import { GHOST_BUTTON, ICON_BUTTON, SCREEN, SELECT, SELECT_ARROW } from '../styles'

type JobStatus = 'pending' | 'decoding' | 'running' | 'done' | 'failed' | 'cancelled'

interface ImportJob {
  id: string
  file: File
  video: boolean // tệp video → hiện nhãn VIDEO và pha "đang tách audio"
  status: JobStatus
  error?: string
  durationMs?: number // biết được sau khi giải mã
  result?: TranscriptionResult
}

const STATUS_COLOR: Record<JobStatus, string> = {
  pending: 'var(--text4)',
  decoding: '#22d3ee',
  running: '#22d3ee',
  done: '#22c55e',
  failed: '#f87171',
  cancelled: 'var(--text4)'
}

const STATUS_ICON: Record<JobStatus, IconName> = {
  pending: 'clock',
  decoding: 'spinner',
  running: 'spinner',
  done: 'check-circle',
  failed: 'warning',
  cancelled: 'x'
}

/** Lỗi giải mã có nguyên nhân rõ ràng thì nói thẳng phải làm gì, không nói chung chung. */
function describeError(error: unknown, L: Dict): string {
  if (error instanceof MediaDecodeError) {
    if (error.reason === 'unsupported-container') return L.impBadContainer
    if (error.reason === 'too-large') return L.impTooLarge
    return L.impDecodeFailed
  }
  return (error as Error).message || L.queueError
}

export function ImportScreen(): JSX.Element {
  const L = useDict()
  const uiLanguage = useUiStore((s) => s.uiLanguage)
  const health = useHealth()
  const config = useServiceConfig()
  const sessionActive = useSessionStore((s) => s.active)
  const sessionConfig = useSessionStore((s) => s.config)

  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [format, setFormat] = useState<'txt' | 'srt'>('txt')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [source, setSource] = useState<Language>(sessionConfig.incoming.source)
  const [target, setTarget] = useState<Language | null>(sessionConfig.incoming.target)
  const [save, setSave] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  // Lượt chạy đọc thẳng từ ref: người dùng đổi ngôn ngữ giữa chừng thì tệp kế tiếp
  // dùng lựa chọn mới, không dùng bản chụp lúc bấm.
  const optionsRef = useRef({ source, target, save })
  useEffect(() => {
    optionsRef.current = { source, target, save }
  }, [source, target, save])
  // Hàng đợi thật nằm ở ref, không suy ra từ `jobs`: vòng chạy sống lâu hơn một lần
  // render, mà state React thì chỉ thấy được ở lần render sau — đọc state ở đây sẽ bỏ
  // sót tệp vừa thêm. `drainingRef` chặn hai vòng cùng chạy (setBusy chưa kịp hiệu lực).
  const queueRef = useRef<ImportJob[]>([])
  const drainingRef = useRef(false)
  // Đã bấm Huỷ cho lượt đang chạy (service dừng ở khúc kế tiếp và vẫn trả kết quả dở).
  const cancelledRef = useRef(false)

  const transcribe = useTranscribeFile()
  const cancelTranscribe = useCancelTranscribe()
  const progress = useTranscribeProgress(busy)
  const historyEnabled = config.data?.historyEnabled !== false
  const serviceUp = health.isSuccess
  // Phiên dịch đang chạy dùng chung model với lượt nhập tệp; chen vào sẽ làm phụ đề
  // của cuộc họp đứng hình, nên chặn hẳn thay vì để hai bên tranh nhau.
  const blocked = !serviceUp || sessionActive

  const doneCount = jobs.filter((j) => j.status === 'done').length
  // "Còn lại" gồm cả tệp đang chạy, đúng như bảng đếm của bản thiết kế.
  const pendingCount = jobs.filter((j) => j.status !== 'done' && j.status !== 'failed').length

  const patch = (id: string, next: Partial<ImportJob>): void => {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...next } : job)))
  }

  const runOne = async (job: ImportJob): Promise<void> => {
    cancelledRef.current = false
    patch(job.id, { status: 'decoding', error: undefined, result: undefined })
    try {
      // Với video, bước này là "tách audio": Chromium demux container và chỉ lấy
      // track tiếng — không cần ffmpeg hay công cụ ngoài nào.
      const decoded = await decodeMediaAudio(job.file)
      // Giải mã không dừng ngang được; bấm Huỷ trong lúc đó thì dừng trước khi gửi đi.
      if (cancelledRef.current) {
        patch(job.id, { status: 'cancelled' })
        return
      }
      patch(job.id, { status: 'running', durationMs: decoded.durationMs })
      const result = await transcribe.mutateAsync({
        pcm: decoded.pcm,
        name: job.file.name,
        ...optionsRef.current
      })
      // Huỷ vẫn trả về phần đã chạy được — giữ nguyên để người dùng đọc/xuất được.
      patch(job.id, { status: result.cancelled ? 'cancelled' : 'done', result })
    } catch (error) {
      patch(job.id, { status: 'failed', error: describeError(error, L) })
    } finally {
      cancelledRef.current = false
    }
  }

  const cancelRunning = (): void => {
    cancelledRef.current = true
    // Bỏ luôn phần còn lại trong hàng đợi: bấm Huỷ mà tệp sau tự chạy tiếp thì lạ.
    queueRef.current = []
    setJobs((prev) =>
      prev.map((job) => (job.status === 'pending' ? { ...job, status: 'cancelled' } : job))
    )
    cancelTranscribe.mutate()
  }

  /** Chạy hết hàng đợi, lần lượt — kể cả tệp được thả vào giữa chừng. */
  const enqueue = (items: ImportJob[]): void => {
    queueRef.current.push(...items)
    void drain()
  }

  const drain = async (): Promise<void> => {
    if (drainingRef.current) return // đã có một lượt đang chạy, nó sẽ nhặt nốt
    drainingRef.current = true
    setBusy(true)
    try {
      for (;;) {
        const next = queueRef.current.shift()
        if (next === undefined) break
        await runOne(next)
      }
    } finally {
      drainingRef.current = false
      setBusy(false)
    }
  }

  const addFiles = (files: FileList | null): void => {
    if (!files || files.length === 0 || blocked) return
    const added: ImportJob[] = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      video: isVideoFile(file),
      status: 'pending'
    }))
    setJobs((prev) => [...prev, ...added])
    enqueue(added) // thả tệp vào là chạy luôn, đúng như thiết kế
  }

  const removeJob = (id: string): void => {
    // Bỏ khỏi cả hàng đợi thật, nếu không tệp vừa xoá vẫn được chạy trong im lặng.
    queueRef.current = queueRef.current.filter((job) => job.id !== id)
    setJobs((prev) => prev.filter((job) => job.id !== id))
  }

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragging(false)
    addFiles(event.dataTransfer.files)
  }

  const statusLabel: Record<JobStatus, string> = {
    pending: L.queuePending,
    decoding: L.queueDecoding,
    running: L.queueProcessing,
    done: L.queueOk,
    failed: L.queueError,
    cancelled: L.queueCancelled
  }

  // Với video, pha giải mã chính là lúc tách audio ra khỏi container — gọi đúng tên
  // để người dùng biết máy đang làm gì (bản thiết kế có nhãn riêng cho pha này).
  const jobStatusLabel = (job: ImportJob): string =>
    job.status === 'decoding' && job.video ? L.phaseExtract : statusLabel[job.status]

  const transcriptText = (job: ImportJob): string =>
    format === 'srt'
      ? transcriptToSrt(job.result?.segments ?? [])
      : transcriptToTxt(job.file.name, job.result?.segments ?? [])

  const copyTranscript = (job: ImportJob): void => {
    void navigator.clipboard.writeText(transcriptText(job)).then(() => {
      setCopiedId(job.id)
      window.setTimeout(() => setCopiedId((id) => (id === job.id ? null : id)), 1600)
    })
  }

  return (
    <div className={`${SCREEN} max-w-205`}>
      <ScreenHeader
        icon="upload"
        title={L.importFiles}
        subtitle={L.importSub}
        color="#2dd4bf"
        tint="rgba(45,212,191,.14)"
      />

      {!serviceUp && <Notice tone="warn" icon="warning" title={L.mbDownT} body={L.mbDownS} />}
      {serviceUp && sessionActive && <Notice tone="warn" icon="warning" title={L.impBusySession} />}

      {/* cặp ngôn ngữ + lưu lịch sử: pipeline cần biết trước khi chạy tệp */}
      <div className="panel flex flex-wrap items-center gap-x-5 gap-y-3 px-4.5 py-3.5">
        <label className="flex items-center gap-2 text-base">
          <span className="text-fg-3">{L.impFileLang}</span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as Language)}
            className={SELECT}
            style={SELECT_ARROW}
          >
            {LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {languageName(uiLanguage, code)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-base">
          <span className="text-fg-3">{L.impTargetLang}</span>
          <select
            value={target ?? ''}
            onChange={(e) => setTarget((e.target.value || null) as Language | null)}
            className={SELECT}
            style={SELECT_ARROW}
          >
            <option value="">{L.impNoTranslate}</option>
            {LANGUAGES.filter((code) => code !== source).map((code) => (
              <option key={code} value={code}>
                {languageName(uiLanguage, code)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-base text-fg-3">
          <input
            type="checkbox"
            checked={save && historyEnabled}
            disabled={!historyEnabled}
            onChange={(e) => setSave(e.target.checked)}
            className="size-4 accent-[#2dd4bf]"
          />
          {L.impSave}
        </label>
        {!historyEnabled && <span className="text-sm text-fg-4">{L.impHistoryOff}</span>}
      </div>

      {/* Danh sách theo bản thiết kế, trừ những container Chromium không demux được
          (avi/flv/wmv/mpeg/ts) — mời chọn rồi mới báo lỗi thì tệ hơn là không mời. */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".mp3,.wav,.m4a,.flac,.ogg,.webm,.opus,.mp4,.mov,.mkv,.m4v,.3gp"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = '' // chọn lại đúng tệp vừa bỏ ra vẫn phải kích hoạt onChange
        }}
      />

      {/* vùng kéo & thả */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          'flex flex-col items-center justify-center rounded-[20px] border-2 border-dashed px-6 py-11 text-center transition-all',
          dragging
            ? 'border-[#2dd4bf] bg-[rgba(45,212,191,.08)]'
            : 'border-line-strong bg-surface hover:border-[rgba(45,212,191,.45)]',
          blocked ? 'pointer-events-none opacity-55' : 'cursor-pointer'
        ].join(' ')}
      >
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-surface text-[#2dd4bf]">
          <Icon name="upload" size={30} />
        </div>
        <div className="text-xl font-bold">{L.dropTitle}</div>
        <div className="mt-2 mb-4.5 max-w-105 text-base leading-normal text-fg-3">{L.dropSub}</div>
        <span className="inline-flex h-9.5 items-center gap-2 rounded-md bg-linear-[135deg,#22d3ee,#3b82f6] px-5 text-md font-bold text-[#04121a] shadow-[0_6px_18px_rgba(34,211,238,.3)]">
          <Icon name="file" size={15} strokeWidth={2.2} />
          {L.browseFiles}
        </span>
      </div>

      {jobs.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4.5 py-3">
            <span className="text-base font-bold">{L.queueTitle}</span>
            <span className="font-mono text-xs text-fg-4">
              {doneCount} {L.queueDone}
              {pendingCount > 0 ? ` · ${pendingCount} ${L.queuePendingN}` : ''}
            </span>
            <div className="ml-auto flex items-center gap-2.5">
              <span className="text-sm text-fg-4">{L.transcriptFmt}</span>
              <Segmented
                value={format}
                onChange={setFormat}
                options={[
                  { value: 'txt', label: '.txt' },
                  { value: 'srt', label: '.srt' }
                ]}
              />
              <DisabledButton
                label={L.diarizeLbl}
                hint={L.diarizeOff}
                icon="mic"
                className="h-7.5 text-sm"
              />
              <button
                className={`${GHOST_BUTTON} h-7.5 text-sm`}
                disabled={doneCount === 0}
                onClick={() => setJobs((prev) => prev.filter((j) => j.status !== 'done'))}
              >
                {L.clearDone}
              </button>
            </div>
          </div>

          <div className="cs max-h-140 overflow-y-auto">
            {jobs.map((job) => {
              const color = STATUS_COLOR[job.status]
              const running = job.status === 'decoding' || job.status === 'running'
              // Service chỉ chạy một tệp một lúc, nên tiến trình nó báo về chính là của
              // tệp đang ở trạng thái `running` — không cần dò theo tên (hai tệp trùng
              // tên sẽ dò nhầm).
              const percent = job.status === 'running' ? (progress.data?.percent ?? 0) : 0
              const segments = job.result?.segments ?? []
              return (
                <div key={job.id} className="border-b border-line-soft px-4.5 py-3.25">
                  <div className="flex items-center gap-3">
                    <span className="flex shrink-0" style={{ color }}>
                      <Icon name={STATUS_ICON[job.status]} size={16} spin={running} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.75">
                        <span className="truncate-1 min-w-0 font-mono text-md font-semibold">
                          {job.file.name}
                        </span>
                        {job.video && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[rgba(45,212,191,.14)] px-1.5 py-0.5 text-3xs font-bold tracking-[0.4px] text-[#2dd4bf]">
                            <Icon name="video" size={10} strokeWidth={2.4} />
                            {L.videoBadge}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-fg-4">
                        {formatBytes(job.file.size)}
                        {job.durationMs != null &&
                          ` · ${L.durationLbl} ${formatDuration(job.durationMs)}`}
                        {job.result &&
                          ` · ${segments.length} ${L.impSegments}${job.result.sessionId ? ` · ${L.impSaved}` : ''}`}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold" style={{ color }}>
                      {/* Đang chạy thì gắn luôn % vào nhãn, như bản thiết kế. */}
                      {job.status === 'running' && progress.data?.percent != null
                        ? `${jobStatusLabel(job)} ${Math.round(progress.data.percent)}%`
                        : jobStatusLabel(job)}
                    </span>

                    {/* Huỷ giữa chừng vẫn có bản ghi dở — vẫn chép/tải được. */}
                    {segments.length > 0 && (
                      <div className="flex gap-1.5">
                        <button
                          className={`${GHOST_BUTTON} h-7.5 text-sm ${copiedId === job.id ? 'text-ac-grn' : ''}`}
                          onClick={() => copyTranscript(job)}
                        >
                          <Icon name="copy" size={13} />
                          {copiedId === job.id ? L.copied : L.copyBtn}
                        </button>
                        <button
                          className={`${GHOST_BUTTON} h-7.5 text-sm`}
                          onClick={() =>
                            downloadText(
                              `${job.file.name.replace(/\.[^.]+$/, '')}.${format}`,
                              transcriptText(job)
                            )
                          }
                        >
                          <Icon name="download" size={13} />
                          {L.downloadBtn}
                        </button>
                      </div>
                    )}
                    {(job.status === 'failed' || job.status === 'cancelled') && (
                      <button
                        title={L.retryTip}
                        disabled={blocked}
                        onClick={() => {
                          patch(job.id, { status: 'pending' })
                          enqueue([job])
                        }}
                        className={`${ICON_BUTTON} size-7 rounded-sm border border-line hover:text-fg-2`}
                      >
                        <Icon name="refresh" size={14} />
                      </button>
                    )}
                    {running && (
                      <button
                        className={`${GHOST_BUTTON} h-7.5 text-sm`}
                        disabled={progress.data?.cancelling === true}
                        onClick={cancelRunning}
                      >
                        {progress.data?.cancelling ? L.cancelling : L.cancelBtn}
                      </button>
                    )}
                    {!running && (
                      <button
                        title={L.removeTip}
                        onClick={() => removeJob(job.id)}
                        className={`${ICON_BUTTON} size-7 hover:bg-[rgba(239,68,68,.1)] hover:text-[#f87171]`}
                      >
                        <Icon name="x" size={15} />
                      </button>
                    )}
                  </div>

                  {running && (
                    <div className="mt-2.5 flex items-center gap-2.5">
                      <Meter value={percent / 100} color="#22d3ee" to="#3b82f6" height={4} />
                      <span className="w-24 shrink-0 text-right font-mono text-xs text-fg-4">
                        {job.status === 'running' && progress.data?.audioMs
                          ? `${formatDuration(progress.data.doneMs)} / ${formatDuration(progress.data.audioMs)}`
                          : L.queueDecoding}
                      </span>
                    </div>
                  )}

                  {job.error && (
                    <div className="mt-2 text-sm leading-snug text-ac-red">{job.error}</div>
                  )}

                  {job.result != null && (
                    <div className="cs mt-2.75 flex max-h-45 flex-col gap-1.5 overflow-y-auto rounded-md border border-line-soft bg-inset px-3.5 py-3">
                      {segments.length === 0 ? (
                        <div className="py-2 text-center text-sm text-fg-5">{L.impNoSpeech}</div>
                      ) : (
                        segments.map((segment) => (
                          <div
                            key={`${segment.startedAtMs}-${segment.endedAtMs}`}
                            className="flex items-baseline gap-2.5 text-base leading-normal"
                          >
                            <span className="shrink-0 font-mono text-xs text-fg-4">
                              {formatDuration(segment.startedAtMs)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="text-fg-2">{segment.text}</span>
                              {segment.translatedText && (
                                <span className="mt-0.5 block text-fg-4">
                                  → {segment.translatedText}
                                </span>
                              )}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="px-4.5 py-2.5 text-xs text-fg-5">{L.impLoadHint}</div>
        </div>
      )}
    </div>
  )
}
