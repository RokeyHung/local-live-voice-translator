import { describe, expect, it } from 'vitest'
import type { ComputeDevice, ComputeStatus } from '../domain/models'
import {
  activeTile,
  autoTarget,
  effectiveChoice,
  formatVram,
  gpuSummary,
  gpuToShow,
  prettyDeviceName,
  serviceCpuShare
} from './compute'

const IRIS: ComputeDevice = {
  id: 'Intel(R) Iris(R) Xe Graphics',
  backend: 'Vulkan',
  kind: 'integrated',
  memoryMb: 16000
}
const RTX: ComputeDevice = {
  id: 'NVIDIA GeForce RTX 4060 Laptop GPU',
  backend: 'Vulkan',
  kind: 'discrete',
  memoryMb: 8188
}

function status(over: Partial<ComputeStatus> = {}): ComputeStatus {
  return {
    choice: 'auto',
    devices: [IRIS, RTX], // thứ tự ggml thật trên laptop hybrid: GPU tích hợp trước
    deviceSelectable: true,
    activeDevice: null,
    asrAdapter: null,
    platform: 'win32',
    cpuName: '12th Gen Intel(R) Core(TM) i5-12500H',
    cpuCores: 16,
    ramGb: 63.7,
    ...over
  }
}

describe('prettyDeviceName', () => {
  it('bỏ ký hiệu thương hiệu và tiền tố hãng lặp lại', () => {
    expect(prettyDeviceName(IRIS.id)).toBe('Intel Iris Xe Graphics')
    expect(prettyDeviceName(RTX.id)).toBe('GeForce RTX 4060 Laptop GPU')
    // Tên CPU cũng đi qua đây: "12th Gen" chỉ chiếm chỗ trên ô.
    expect(prettyDeviceName('12th Gen Intel(R) Core(TM) i5-12500H')).toBe('Intel Core i5-12500H')
  })
})

describe('gpuSummary', () => {
  it('nhiều card thì đếm, một card thì ghi tên', () => {
    expect(gpuSummary([IRIS, RTX])).toBe('2 GPU · Vulkan')
    expect(gpuSummary([RTX])).toBe('GeForce RTX 4060 Laptop GPU · Vulkan')
    expect(gpuSummary([])).toBe('')
  })
})

describe('formatVram', () => {
  it('đổi MB ra GB, không có số thì không bịa', () => {
    expect(formatVram(8188)).toBe('8 GB')
    expect(formatVram(null)).toBeNull()
  })
})

describe('autoTarget', () => {
  it('card rời thắng GPU tích hợp đứng trước nó — đúng luật bên service', () => {
    expect(autoTarget([IRIS, RTX])).toBe(RTX)
  })

  it('chỉ có GPU tích hợp thì vẫn dùng nó; không có GPU thì CPU', () => {
    expect(autoTarget([IRIS])).toBe(IRIS)
    expect(autoTarget([])).toBeNull()
  })
})

describe('activeTile', () => {
  it('chưa nạp model thì không ô nào đang chạy', () => {
    expect(activeTile(status())).toBeNull()
  })

  it('đánh dấu đúng card, không phải ô "Tự động" đã trỏ tới nó', () => {
    expect(activeTile(status({ activeDevice: RTX.id }))).toBe(RTX.id)
    expect(activeTile(status({ activeDevice: 'cpu' }))).toBe('cpu')
  })

  it('macOS: không liệt kê được GPU nhưng đang chạy Metal → ô Tự động', () => {
    expect(activeTile(status({ devices: [], activeDevice: 'MTL0' }))).toBe('auto')
  })
})

describe('effectiveChoice', () => {
  it('GPU đã lưu không còn trên máy thì coi như Tự động, như service làm', () => {
    expect(effectiveChoice(status({ choice: 'AMD Radeon RX 7900' }))).toBe('auto')
    expect(effectiveChoice(status({ choice: RTX.id }))).toBe(RTX.id)
    expect(effectiveChoice(status({ choice: 'cpu' }))).toBe('cpu')
  })
})

describe('gpuToShow', () => {
  const gpus = [
    { name: IRIS.id, percent: 6 }, // Windows vẽ màn hình bằng GPU tích hợp
    { name: RTX.id, percent: 91 }
  ]

  it('ưu tiên GPU đang chạy nhận dạng giọng nói', () => {
    expect(gpuToShow(gpus, RTX.id)?.percent).toBe(91)
    expect(gpuToShow(gpus, IRIS.id)?.percent).toBe(6)
  })

  it('chưa nạp model thì hiện GPU đang bận nhất, không phải GPU đầu tiên', () => {
    expect(gpuToShow(gpus, null)?.name).toBe(RTX.id)
  })

  it('không đọc được GPU (macOS) thì không bịa số', () => {
    expect(gpuToShow([], RTX.id)).toBeNull()
  })
})

describe('serviceCpuShare', () => {
  it('đổi % theo lõi của psutil ra phần của cả máy — "400%" trên 16 luồng là 25%', () => {
    expect(serviceCpuShare(400, 16)).toBe(25)
    expect(serviceCpuShare(2000, 16)).toBe(100)
    expect(serviceCpuShare(50, 0)).toBe(0)
  })
})
