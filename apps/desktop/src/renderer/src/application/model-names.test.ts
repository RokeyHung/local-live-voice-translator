// Quy tắc về tên model — cùng một model có nhiều cách viết tuỳ chỗ nó đến từ đâu.

import { describe, expect, it } from 'vitest'
import {
  guessDownloadKind,
  isModelLoaded,
  kindFromPath,
  looksLikeModelPath,
  normalizeModelName
} from './model-names'

describe('looksLikeModelPath', () => {
  it('nhận đường dẫn HuggingFace và file GGML', () => {
    expect(looksLikeModelPath('mlx-community/whisper-tiny-asr-4bit')).toBe(true)
    expect(looksLikeModelPath('facebook/nllb-200-1.3B')).toBe(true)
    expect(looksLikeModelPath('ggml-small-q5_1.bin')).toBe(true)
    expect(looksLikeModelPath('  facebook/nllb-200-1.3B  ')).toBe(true)
  })

  it('từ chối chuỗi tìm kiếm thường, để danh mục không hiện nút tải bừa', () => {
    expect(looksLikeModelPath('whisper')).toBe(false)
    expect(looksLikeModelPath('nllb 600M')).toBe(false)
    expect(looksLikeModelPath('')).toBe(false)
    // Thiếu đuôi .bin thì pywhispercpp không nhận, đừng mời người dùng tải.
    expect(looksLikeModelPath('ggml-small-q5_1')).toBe(false)
    // Hai dấu gạch chéo không phải dạng `tổ-chức/tên-repo`.
    expect(looksLikeModelPath('a/b/c')).toBe(false)
  })
})

describe('guessDownloadKind', () => {
  it('đoán đúng runtime từ dạng đường dẫn', () => {
    expect(guessDownloadKind('ggml-large-v3-turbo-q5_0.bin')).toBe('whisper_cpp')
    expect(guessDownloadKind('pyannote/speaker-diarization-community-1')).toBe('pyannote')
    expect(guessDownloadKind('facebook/nllb-200-distilled-600M')).toBe('nllb')
    expect(guessDownloadKind('mlx-community/whisper-tiny-asr-4bit')).toBe('mlx')
    expect(guessDownloadKind('Systran/faster-whisper-small')).toBe('faster_whisper')
    expect(guessDownloadKind('deepdml/faster-whisper-large-v3-turbo-ct2')).toBe('faster_whisper')
  })

  it('không đoán được thì vẫn trả một giá trị hợp lệ để ô chọn có mặc định', () => {
    expect(guessDownloadKind('mot-ai-do/mot-model-la')).toBe('mlx')
  })
})

describe('kindFromPath', () => {
  it('suy runtime từ thư mục service đã đặt model vào', () => {
    expect(kindFromPath('/models/whisper-cpp/ggml-tiny-q5_1.bin')).toBe('whisper_cpp')
    expect(kindFromPath('/models/mlx-whisper/models--mlx-community--whisper-tiny')).toBe('mlx')
    expect(kindFromPath('/models/faster-whisper/models--Systran--x')).toBe('faster_whisper')
    expect(kindFromPath('/models/nllb/models--facebook--nllb-200-1.3B')).toBe('nllb')
    expect(kindFromPath('/models/pyannote/models--pyannote--x')).toBe('pyannote')
  })

  it('chạy đúng cả với đường dẫn Windows', () => {
    expect(kindFromPath('C:\\Users\\a\\.llvt\\models\\whisper-cpp\\ggml-tiny.bin')).toBe(
      'whisper_cpp'
    )
  })

  it('TTS không cần runtime — service tự nhận ra từ tên', () => {
    expect(kindFromPath('/models/sherpa-tts/vits-piper-vi_VN-vais1000-medium')).toBeUndefined()
    expect(kindFromPath('/models/kokoro-ja')).toBeUndefined()
  })
})

describe('isModelLoaded', () => {
  // Đĩa trả tên file KHÔNG có `.bin` (`Path.stem`), service trả tên đầy đủ có `.bin`.
  it('khớp model GGML dù hai bên viết khác nhau', () => {
    expect(isModelLoaded('ggml-small-q5_1', ['ggml-small-q5_1.bin'])).toBe(true)
    expect(isModelLoaded('ggml-small-q5_1', ['small-q5_1'])).toBe(true)
  })

  it('khớp repo HuggingFace', () => {
    expect(
      isModelLoaded('facebook/nllb-200-distilled-600M', ['facebook/nllb-200-distilled-600M'])
    ).toBe(true)
  })

  it('KHÔNG khớp nhầm model khác cỡ', () => {
    expect(isModelLoaded('ggml-large-v3-turbo-q5_0', ['ggml-small-q5_1.bin'])).toBe(false)
    expect(isModelLoaded('facebook/nllb-200-1.3B', ['facebook/nllb-200-distilled-600M'])).toBe(
      false
    )
  })

  it('không nạp gì thì không có gì khớp', () => {
    expect(isModelLoaded('ggml-small-q5_1', [])).toBe(false)
  })

  it('tên quá ngắn không được dùng để so chứa — dễ khớp bừa', () => {
    expect(isModelLoaded('ab', ['abcdef'])).toBe(false)
  })
})

describe('normalizeModelName', () => {
  it('quy mọi cách viết của cùng một model về một chuỗi', () => {
    const forms = ['ggml-small-q5_1.bin', 'ggml-small-q5_1', 'small-q5_1']
    expect(new Set(forms.map(normalizeModelName)).size).toBe(1)
  })
})
