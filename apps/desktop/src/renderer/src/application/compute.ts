// Luật thuần cho ô "Cấu hình thực thi" (màn Thiết bị âm thanh).
//
// Mọi dữ liệu phần cứng ở đây đến từ AI service (GET /api/compute) — chính tiến trình
// chạy model. Bản cũ đọc từ renderer và sai theo ba kiểu: Chromium chỉ thấy GPU nó
// dùng để vẽ giao diện (trên laptop hybrid là GPU tích hợp), chặn RAM ở 8 GB, và
// chuỗi userAgent có "AppleWebKit" khiến máy Windows bị nhận là Apple.

import type { ComputeDevice, ComputeStatus } from '../domain/models'

export const AUTO = 'auto'
export const CPU_ONLY = 'cpu'

/** Tên card gọn để đặt trên ô: bỏ (R)/(TM) và tiền tố hãng lặp lại. */
export function prettyDeviceName(id: string): string {
  return id
    .replace(/\((R|TM|C)\)/gi, '')
    .replace(/^\d+(st|nd|rd|th) Gen /i, '')
    .replace(/^NVIDIA GeForce /i, 'GeForce ')
    .replace(/^AMD Radeon\(?TM\)? /i, 'Radeon ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tóm tắt cho ô GPU: "2 GPU · Vulkan". Tên từng card đã nằm trên các ô chọn bên dưới. */
export function gpuSummary(devices: ComputeDevice[]): string {
  if (devices.length === 0) return ''
  const backends = [...new Set(devices.map((d) => d.backend))].join(' / ')
  return devices.length === 1
    ? `${prettyDeviceName(devices[0].id)} · ${backends}`
    : `${devices.length} GPU · ${backends}`
}

/** "8 GB" từ MB; null khi driver không báo. */
export function formatVram(memoryMb: number | null): string | null {
  if (!memoryMb) return null
  return `${Math.round(memoryMb / 1024)} GB`
}

/**
 * Thiết bị mà "Tự động" sẽ dùng — cùng luật với `pick_gpu_device` bên service:
 * card rời trước, không có thì GPU đầu tiên (kể cả tích hợp), không có GPU nào thì CPU.
 */
export function autoTarget(devices: ComputeDevice[]): ComputeDevice | null {
  return devices.find((d) => d.kind === 'discrete') ?? devices[0] ?? null
}

/**
 * Ô nào đang THẬT SỰ chạy model. Khác với ô đang chọn: chọn xong phải nạp lại model
 * mới có hiệu lực, và "Tự động" không bao giờ là thiết bị — nó trỏ tới một GPU cụ thể.
 */
export function activeTile(status: ComputeStatus): string | null {
  const active = status.activeDevice
  if (!active) return null
  if (active === CPU_ONLY) return CPU_ONLY
  if (status.devices.some((d) => d.id === active)) return active
  // Không liệt kê được GPU (macOS: ggml báo "MTL0") nhưng rõ là đang chạy GPU —
  // đánh dấu "Tự động", ô duy nhất đại diện cho GPU trên máy đó.
  return AUTO
}

/** Lựa chọn đã lưu còn hợp lệ không; GPU đã tháo thì service tự lùi về auto. */
export function effectiveChoice(status: ComputeStatus): string {
  const { choice, devices } = status
  if (choice === AUTO || choice === CPU_ONLY) return choice
  return devices.some((d) => d.id === choice) ? choice : AUTO
}
