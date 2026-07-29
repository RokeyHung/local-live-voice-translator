// Adapter: nhận diện phần cứng có thể thấy được từ renderer.
//
// Renderer chạy trong sandbox Chromium nên chỉ đọc được những gì trình duyệt cho
// phép: số lõi logic (hardwareConcurrency), RAM xấp xỉ (deviceMemory — Chromium
// chặn trần ở 8 GB), tên GPU qua WEBGL_debug_renderer_info, và có WebGPU hay không.
// Việc chọn backend thật (CUDA/Metal/Vulkan) do ai-service quyết định.

import type { ComputeBackend, ComputeKind } from '../domain/enums'
import type { ComputeInfo } from '../domain/models'

type NavigatorWithMemory = Navigator & { deviceMemory?: number; gpu?: unknown }

function readGpu(): { renderer: string; vendor: string } {
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return { renderer: '', vendor: '' }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (ext) {
      return {
        renderer: String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? ''),
        vendor: String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) ?? '')
      }
    }
    return {
      renderer: String(gl.getParameter(gl.RENDERER) ?? ''),
      vendor: String(gl.getParameter(gl.VENDOR) ?? '')
    }
  } catch {
    return { renderer: '', vendor: '' }
  }
}

function classify(haystack: string): ComputeKind {
  if (/nvidia|geforce|rtx|gtx|quadro|tesla|cuda/.test(haystack)) return 'nvidia'
  if (/apple|metal|m1|m2|m3|m4/.test(haystack)) return 'apple'
  if (/radeon|amd|rx |vega/.test(haystack)) return 'amd'
  if (/intel|iris|uhd|hd graphics/.test(haystack)) return 'intel'
  return 'cpu'
}

const RECOMMENDED: Record<ComputeKind, ComputeBackend> = {
  nvidia: 'cuda',
  apple: 'metal',
  amd: 'vulkan',
  intel: 'vulkan',
  cpu: 'cpu'
}

export function probeCompute(): ComputeInfo {
  const nav = navigator as NavigatorWithMemory
  const { renderer, vendor } = readGpu()
  const kind = classify(`${renderer} ${vendor} ${navigator.userAgent}`.toLowerCase())
  const ramGb = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null

  return {
    kind,
    gpuRenderer: renderer,
    gpuVendor: vendor,
    cpuCores: navigator.hardwareConcurrency || null,
    ramGb,
    ramCapped: ramGb === 8, // Chromium báo tối đa 8 GB, máy thật có thể nhiều hơn
    webgpu: !!nav.gpu,
    recommended: RECOMMENDED[kind]
  }
}

// Tên GPU thô thường kèm chuỗi ANGLE/Direct3D — rút gọn cho dễ đọc.
export function prettyGpuName(renderer: string): string {
  return renderer
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/(ANGLE|Direct3D11|OpenGL|vs_5_0|ps_5_0|,).*/i, '')
    .trim()
    .slice(0, 46)
}
