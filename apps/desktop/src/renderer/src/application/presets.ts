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
  }
}

// Danh mục model tham khảo (docs/02_spec-addendum-os-stack-models.md). Chỉ để tra
// cứu — tải model vẫn làm thủ công, giao diện chưa nối với AI service.
//
// Tên voice TTS phải khớp asset trong release `tts-models` của k2-fsa/sherpa-onnx.
// Không có tiếng Nhật ở đây vì release đó chưa có model VITS tiếng Nhật nào.
export interface CatalogEntry {
  stage: 'ASR' | 'MT' | 'TTS'
  name: string
  detail: string
  size: string
}

export const MODEL_CATALOG: CatalogEntry[] = [
  {
    stage: 'ASR',
    name: 'whisper-large-v3-turbo-q5',
    detail: 'ggerganov · whisper.cpp · vi/en/ja/zh',
    size: '809 MB'
  },
  { stage: 'ASR', name: 'whisper-small-q5', detail: 'ggerganov · whisper.cpp', size: '190 MB' },
  {
    stage: 'ASR',
    name: 'whisper-large-v3-turbo-q8',
    detail: 'ggerganov · whisper.cpp',
    size: '1.2 GB'
  },
  {
    stage: 'MT',
    name: 'nllb-200-distilled-600M',
    detail: 'facebook · transformers · 200 lang',
    size: '2.4 GB'
  },
  { stage: 'MT', name: 'nllb-200-distilled-600M-int8', detail: 'facebook · int8', size: '640 MB' },
  { stage: 'MT', name: 'nllb-200-1.3B', detail: 'facebook · 200 lang', size: '5.5 GB' },
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
    name: 'vits-piper-zh_CN-xiao_ya-medium',
    detail: 'rhasspy · sherpa-onnx · zh',
    size: '62 MB'
  }
]

export const STAGE_COLORS: Record<string, string> = {
  VAD: '#4ade80',
  ASR: '#22d3ee',
  MT: '#fb923c',
  TTS: '#d946ef'
}
