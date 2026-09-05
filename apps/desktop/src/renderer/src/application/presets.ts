// Chỉ còn phần TRÌNH BÀY của preset (tên hiển thị, màu, mô tả, RAM khuyến nghị).
//
// Danh sách model/adapter/thiết bị của từng khâu KHÔNG nằm ở đây nữa: service trả
// về qua GET /api/config → `stages`, lấy trực tiếp từ provider đang chạy. Nhờ vậy
// giao diện không thể lệch với thực tế khi bên service đổi preset.

import type { Preset } from '../domain/enums'

export interface PresetMeta {
  id: Preset
  name: string
  // RAM/VRAM xấp xỉ theo docs/02 — dùng để cảnh báo khi máy thiếu bộ nhớ.
  ramGb: number
  color: string
  tint: string
  descVi: string
  descEn: string
}

export const PRESET_META: Record<Preset, PresetMeta> = {
  fast: {
    id: 'fast',
    name: 'Fast',
    ramGb: 3,
    color: 'var(--ac-grn2)',
    tint: 'rgba(74,222,128,.12)',
    descVi: 'Model nhỏ, quantize. Ưu tiên độ trễ thấp cho CPU.',
    descEn: 'Small quantized models. Low latency for CPU.'
  },
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    ramGb: 6,
    color: '#22d3ee',
    tint: 'rgba(34,211,238,.12)',
    descVi: 'Whisper large-v3-turbo Q5 + NLLB-600M. Mặc định.',
    descEn: 'Whisper large-v3-turbo Q5 + NLLB-600M. Default.'
  },
  quality: {
    id: 'quality',
    name: 'Quality',
    ramGb: 11,
    color: '#a855f7',
    tint: 'rgba(168,85,247,.12)',
    descVi: 'Whisper Q8 + NLLB-600M. Chất lượng cao nhất.',
    descEn: 'Whisper Q8 + NLLB-600M. Highest quality.'
  },
  // RAM để bằng Balanced vì đó là gốc của bộ tự chọn; chọn model to hơn thì con số
  // này thành thiếu, nhưng cảnh báo hụt còn hơn cảnh báo sai.
  custom: {
    id: 'custom',
    name: 'Custom',
    ramGb: 6,
    color: '#f472b6',
    tint: 'rgba(244,114,182,.12)',
    descVi: 'Tự chọn model cho khâu ASR và MT.',
    descEn: 'Pick your own ASR and MT models.'
  }
}

// Danh mục model (docs/02_spec-addendum-os-stack-models.md). Bấm Tải ở màn Quản lý
// model là service tải thật về `modelsDir` (POST /api/models/download) — bảng này chỉ
// còn là phần TRÌNH BÀY: tên, mô tả, dung lượng, nền tảng chạy được.
//
// `name` là tên LOGIC mà AI service hiểu: đặt được thẳng vào preset
// (`config/presets.py`) hoặc vào `LLVT_ASR_ADAPTER`/`LLVT_DIARIZATION_MODEL`. Không
// phải tên file trên đĩa — chỗ đó là cột "đã cài" bên trái, dựng từ `GET /api/models`.
//
// `size` là dung lượng THẬT lấy từ HuggingFace API, không phải ước lượng.
//
// Tên voice TTS phải khớp asset trong release `tts-models` của k2-fsa/sherpa-onnx.
// Không có tiếng Nhật ở đây vì release đó chưa có model VITS tiếng Nhật nào.
export interface CatalogEntry {
  stage: 'ASR' | 'MT' | 'TTS' | 'DIA'
  name: string
  detail: string
  size: string
  // Chỉ chạy được trên nền tảng này (giá trị của `process.platform`). Bỏ trống = mọi
  // máy. Model MLX cần Metal của Apple Silicon nên nêu rõ, để người dùng Windows
  // không mất công thử một thứ máy họ không chạy được.
  platform?: 'darwin' | 'win32'
  // Cần cài thêm gói tùy chọn của AI service (`uv sync --extra <tên>`).
  extra?: 'mlx' | 'diarization' | 'ctranslate2'
}

export const MODEL_CATALOG: CatalogEntry[] = [
  // --- ASR · whisper.cpp (GGML) — runtime mặc định cho cả Windows lẫn macOS ---
  //
  // Cố tình KHÔNG liệt kê biến thể `.en`: ứng dụng luôn phải nhận cả vi/ja/zh, model
  // English-only sẽ trả rác cho ba thứ tiếng đó.
  {
    stage: 'ASR',
    name: 'whisper-large-v3-turbo-q5',
    detail: 'ggerganov · whisper.cpp · vi/en/ja/zh',
    size: '574 MB'
  },
  {
    stage: 'ASR',
    name: 'whisper-large-v3-turbo-q8',
    detail: 'ggerganov · whisper.cpp · vi/en/ja/zh',
    size: '874 MB'
  },
  {
    stage: 'ASR',
    name: 'whisper-large-v3-turbo',
    detail: 'ggerganov · whisper.cpp · fp16',
    size: '1.62 GB'
  },
  {
    stage: 'ASR',
    name: 'whisper-large-v3-q5',
    detail: 'ggerganov · whisper.cpp · chính xác nhất',
    size: '1.08 GB'
  },
  {
    stage: 'ASR',
    name: 'whisper-large-v3',
    detail: 'ggerganov · whisper.cpp · fp16',
    size: '3.10 GB'
  },
  {
    stage: 'ASR',
    name: 'whisper-medium-q5',
    detail: 'ggerganov · whisper.cpp',
    size: '539 MB'
  },
  {
    stage: 'ASR',
    name: 'whisper-medium-q8',
    detail: 'ggerganov · whisper.cpp',
    size: '823 MB'
  },
  { stage: 'ASR', name: 'whisper-medium', detail: 'ggerganov · whisper.cpp', size: '1.53 GB' },
  {
    stage: 'ASR',
    name: 'whisper-small-q5',
    detail: 'ggerganov · whisper.cpp · preset Fast',
    size: '190 MB'
  },
  { stage: 'ASR', name: 'whisper-small-q8', detail: 'ggerganov · whisper.cpp', size: '264 MB' },
  { stage: 'ASR', name: 'whisper-small', detail: 'ggerganov · whisper.cpp', size: '488 MB' },
  { stage: 'ASR', name: 'whisper-base-q5', detail: 'ggerganov · whisper.cpp', size: '60 MB' },
  { stage: 'ASR', name: 'whisper-base-q8', detail: 'ggerganov · whisper.cpp', size: '82 MB' },
  { stage: 'ASR', name: 'whisper-tiny-q5', detail: 'ggerganov · whisper.cpp', size: '32 MB' },
  { stage: 'ASR', name: 'whisper-tiny-q8', detail: 'ggerganov · whisper.cpp', size: '44 MB' },

  // --- ASR · MLX (Apple Silicon / Metal) — LLVT_ASR_ADAPTER=mlx_whisper ---
  {
    stage: 'ASR',
    name: 'mlx-whisper-large-v3-turbo-q8',
    detail: 'mlx-community · mlx-audio · preset Balanced',
    size: '868 MB',
    platform: 'darwin',
    extra: 'mlx'
  },
  {
    stage: 'ASR',
    name: 'mlx-whisper-large-v3-turbo',
    detail: 'mlx-community · mlx-audio · fp16',
    size: '1.62 GB',
    platform: 'darwin',
    extra: 'mlx'
  },
  {
    stage: 'ASR',
    name: 'mlx-whisper-large-v3-turbo-q4',
    detail: 'mlx-community · mlx-audio',
    size: '468 MB',
    platform: 'darwin',
    extra: 'mlx'
  },
  {
    stage: 'ASR',
    name: 'mlx-whisper-large-v3-q8',
    detail: 'mlx-community · mlx-audio · chính xác nhất',
    size: '1.27 GB',
    platform: 'darwin',
    extra: 'mlx'
  },
  {
    stage: 'ASR',
    name: 'mlx-whisper-large-v3',
    detail: 'mlx-community · mlx-audio · fp16',
    size: '3.09 GB',
    platform: 'darwin',
    extra: 'mlx'
  },
  {
    stage: 'ASR',
    name: 'mlx-whisper-large-v3-q4',
    detail: 'mlx-community · mlx-audio',
    size: '882 MB',
    platform: 'darwin',
    extra: 'mlx'
  },
  {
    stage: 'ASR',
    name: 'mlx-whisper-small-q8',
    detail: 'mlx-community · mlx-audio · preset Fast',
    size: '263 MB',
    platform: 'darwin',
    extra: 'mlx'
  },
  {
    stage: 'ASR',
    name: 'mlx-whisper-small',
    detail: 'mlx-community · mlx-audio · fp16',
    size: '486 MB',
    platform: 'darwin',
    extra: 'mlx'
  },
  {
    stage: 'ASR',
    name: 'mlx-whisper-small-q4',
    detail: 'mlx-community · mlx-audio',
    size: '144 MB',
    platform: 'darwin',
    extra: 'mlx'
  },
  {
    stage: 'ASR',
    name: 'mlx-whisper-tiny-q8',
    detail: 'mlx-community · mlx-audio',
    size: '45 MB',
    platform: 'darwin',
    extra: 'mlx'
  },
  {
    stage: 'ASR',
    name: 'mlx-whisper-tiny',
    detail: 'mlx-community · mlx-audio · fp16',
    size: '79 MB',
    platform: 'darwin',
    extra: 'mlx'
  },
  {
    stage: 'ASR',
    name: 'mlx-whisper-tiny-q4',
    detail: 'mlx-community · mlx-audio',
    size: '26 MB',
    platform: 'darwin',
    extra: 'mlx'
  },

  // --- ASR · faster-whisper (CTranslate2) — LLVT_ASR_ADAPTER=faster_whisper ---
  //
  // Chạy được cả hai nền tảng nên KHÔNG khoá `platform`, nhưng chỗ nó ăn điểm là
  // Windows + NVIDIA (fp16 trên nhân CUDA riêng); trên CPU thì chạy int8.
  {
    stage: 'ASR',
    name: 'fw-whisper-large-v3-turbo',
    detail: 'deepdml · CTranslate2 · preset Balanced',
    size: '1.62 GB',
    extra: 'ctranslate2'
  },
  {
    stage: 'ASR',
    name: 'fw-whisper-large-v3',
    detail: 'Systran · CTranslate2 · chính xác nhất',
    size: '3.09 GB',
    extra: 'ctranslate2'
  },
  {
    stage: 'ASR',
    name: 'fw-whisper-medium',
    detail: 'Systran · CTranslate2',
    size: '1.53 GB',
    extra: 'ctranslate2'
  },
  {
    stage: 'ASR',
    name: 'fw-whisper-small',
    detail: 'Systran · CTranslate2 · preset Fast',
    size: '486 MB',
    extra: 'ctranslate2'
  },
  {
    stage: 'ASR',
    name: 'fw-whisper-base',
    detail: 'Systran · CTranslate2',
    size: '148 MB',
    extra: 'ctranslate2'
  },
  {
    stage: 'ASR',
    name: 'fw-whisper-tiny',
    detail: 'Systran · CTranslate2',
    size: '78 MB',
    extra: 'ctranslate2'
  },

  // --- MT ---
  {
    stage: 'MT',
    name: 'nllb-200-distilled-600M',
    detail: 'facebook · transformers · 200 lang',
    size: '2.4 GB'
  },
  { stage: 'MT', name: 'nllb-200-distilled-600M-int8', detail: 'facebook · int8', size: '640 MB' },
  { stage: 'MT', name: 'nllb-200-1.3B', detail: 'facebook · 200 lang', size: '5.5 GB' },

  // --- TTS ---
  {
    stage: 'TTS',
    name: 'vits-piper-vi_VN-vais1000-medium',
    detail: 'rhasspy · sherpa-onnx · vi',
    size: '63 MB'
  },
  {
    stage: 'TTS',
    name: 'vits-piper-en_US-lessac-medium',
    detail: 'rhasspy · sherpa-onnx · en',
    size: '64 MB'
  },
  {
    stage: 'TTS',
    name: 'sherpa-onnx-vits-zh-ll',
    detail: 'k2-fsa · sherpa-onnx · zh',
    size: '119 MB'
  },
  {
    stage: 'TTS',
    name: 'kokoro-ja',
    detail: 'hexgrad · kokoro-onnx + OpenJTalk · ja',
    size: '354 MB'
  },

  // --- DIA · tách người nói (chỉ dùng ở màn Nhập tệp) ---
  {
    stage: 'DIA',
    name: 'pyannote/speaker-diarization-community-1',
    detail: 'pyannote · cần token HF lần tải đầu',
    size: '33 MB',
    extra: 'diarization'
  }
]

export const STAGE_COLORS: Record<string, string> = {
  VAD: '#4ade80',
  ASR: '#22d3ee',
  MT: '#fb923c',
  TTS: '#d946ef',
  DIA: '#f59e0b'
}
