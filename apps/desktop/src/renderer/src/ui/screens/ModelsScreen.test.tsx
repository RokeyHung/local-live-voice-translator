// Màn Quản lý model, render thật với một service giả ở tầng `fetch`.
//
// Mỗi test dưới đây khoá lại một quyết định đã phải sửa bằng tay ít nhất một lần:
// bấm preset thì không được nạp, model tải dở không được tính là đã tải, ô chọn model
// phải theo runtime, và ô tìm kiếm phải tải được repo ngoài danh mục. Đó là lý do
// chúng test qua `fetch` chứ không giả hook — thứ hỏng ở những lần đó luôn nằm giữa
// nút bấm và dây REST, đúng khoảng mà việc giả hook sẽ che mất.

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { InstalledModel } from '../../domain/models'
import {
  errorResponse,
  fakeService,
  LOADED_STAGES,
  renderScreen,
  resetStores
} from '../../test/harness'
import { ModelsScreen } from './ModelsScreen'

const onDisk = (patch: Partial<InstalledModel> = {}): InstalledModel => ({
  name: 'ggml-small-q5_1',
  stage: 'ASR',
  path: '/models/whisper-cpp/ggml-small-q5_1.bin',
  sizeBytes: 190_085_487,
  complete: true,
  ...patch
})

beforeEach(() => resetStores())

describe('nạp model', () => {
  it('chưa nạp thì hiện nút Khởi động model, và chỉ nút đó mới nạp', async () => {
    const svc = fakeService()
    renderScreen(<ModelsScreen />)

    const start = await screen.findByRole('button', { name: /Khởi động model/ })
    expect(svc.callsTo('/api/models/load')).toHaveLength(0)

    await userEvent.click(start)

    await waitFor(() => expect(svc.callsTo('/api/models/load')).toHaveLength(1))
  })

  it('BẤM PRESET KHÔNG NẠP MODEL — chỉ ghi nhận lựa chọn', async () => {
    // Trước đây đổi preset gọi thẳng load_preset(): bấm thử một preset để xem nó gồm
    // model gì là đủ để service ngồi nạp 4 khâu, và nút "Khởi động model" bên cạnh
    // thành ra vô nghĩa.
    const svc = fakeService()
    renderScreen(<ModelsScreen />)

    await userEvent.click(await screen.findByRole('button', { name: /Quality/ }))

    await waitFor(() =>
      expect(svc.callsTo('/api/config').some((c) => c.method === 'PUT')).toBe(true)
    )
    expect(svc.callsTo('/api/models/load')).toHaveLength(0)
  })

  it('đã nạp thì đổi sang Nạp lại + Giải phóng', async () => {
    const svc = fakeService()
    svc.config = { ...svc.config, stages: LOADED_STAGES }
    renderScreen(<ModelsScreen />)

    expect(await screen.findByRole('button', { name: /Nạp lại/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Khởi động model/ })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /Giải phóng/ }))

    await waitFor(() => expect(svc.callsTo('/api/models/unload')).toHaveLength(1))
  })

  it('hiện model và thiết bị THẬT do service báo về', async () => {
    const svc = fakeService()
    svc.config = { ...svc.config, stages: LOADED_STAGES }
    renderScreen(<ModelsScreen />)

    // Tìm theo `accel` chứ không theo tên model: tên model còn xuất hiện trong danh
    // mục bên phải, nên bám vào nó thì test đi qua kể cả khi bảng khâu chưa render.
    const row = (await screen.findByText('Metal')).closest('div')!

    // Đúng đường dẫn thượng nguồn, không phải id nội bộ `small-q5_1` của pywhispercpp.
    expect(row.textContent).toContain('ggml-small-q5_1.bin')
    expect(row.textContent).toContain('whisper_cpp')
  })
})

describe('model tải dở dang', () => {
  it('gắn nhãn riêng và cho tải lại, thay vì trông như model bình thường', async () => {
    const svc = fakeService()
    svc.models = [onDisk({ complete: false, sizeBytes: 5_000_000 })]
    renderScreen(<ModelsScreen />)

    expect(await screen.findByText('Tải chưa xong')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /Tải lại/ }))

    await waitFor(() => expect(svc.callsTo('/api/models/download')).toHaveLength(1))
    // `force` xoá bản hỏng trước khi tải; thiếu nó thì service bỏ qua model "đã có"
    // và nút Tải lại không làm gì cả. `kind` suy từ thư mục service đã đặt model vào.
    expect(svc.callsTo('/api/models/download')[0].body).toMatchObject({
      name: 'ggml-small-q5_1',
      kind: 'whisper_cpp',
      force: true
    })
  })

  it('KHÔNG được tính là "Đã tải" ở danh mục', async () => {
    const svc = fakeService()
    svc.models = [onDisk({ complete: false })]
    renderScreen(<ModelsScreen />)

    // Lọc danh mục xuống đúng một dòng để khẳng định được nhãn của riêng nó.
    await userEvent.type(await screen.findByPlaceholderText(/Lọc danh mục/), 'ggml-small-q5_1')

    await waitFor(() => expect(screen.queryByText('Đã tải')).toBeNull())
    expect(screen.getByRole('button', { name: /Tải về/ })).toBeTruthy()
  })

  it('bản tải đủ thì danh mục gắn nhãn Đã tải', async () => {
    const svc = fakeService()
    svc.models = [onDisk({ complete: true })]
    renderScreen(<ModelsScreen />)

    await userEvent.type(await screen.findByPlaceholderText(/Lọc danh mục/), 'ggml-small-q5_1')

    expect(await screen.findByText('Đã tải')).toBeTruthy()
  })

  it('xoá được bản dở qua đúng đường dẫn service đã trả về', async () => {
    const svc = fakeService()
    const model = onDisk({ complete: false })
    svc.models = [model]
    renderScreen(<ModelsScreen />)

    await screen.findByText('Tải chưa xong')
    // Nút xoá chỉ có icon; nó là nút cuối cùng của dòng model đó.
    const row = screen.getByText('Tải chưa xong').closest('div')!.parentElement!
    const buttons = within(row).getAllByRole('button')
    window.confirm = () => true
    await userEvent.click(buttons[buttons.length - 1])

    await waitFor(() => expect(svc.callsTo('/api/models/one')).toHaveLength(1))
    expect(svc.callsTo('/api/models/one')[0].query.get('path')).toBe(model.path)
  })
})

describe('tải model ngoài danh mục', () => {
  it('gõ một đường dẫn HuggingFace thì tải được, kèm runtime đoán sẵn', async () => {
    const svc = fakeService()
    renderScreen(<ModelsScreen />)

    const box = await screen.findByPlaceholderText(/Lọc danh mục/)
    await userEvent.type(box, 'mot-to-chuc/whisper-rieng')

    await userEvent.click(await screen.findByRole('button', { name: /Tải về/ }))

    await waitFor(() => expect(svc.callsTo('/api/models/download')).toHaveLength(1))
    expect(svc.callsTo('/api/models/download')[0].body).toMatchObject({
      name: 'mot-to-chuc/whisper-rieng',
      kind: 'mlx'
    })
  })

  it('chuỗi tìm kiếm thường thì KHÔNG mời tải — nó không phải tên model', async () => {
    fakeService()
    renderScreen(<ModelsScreen />)

    await userEvent.type(await screen.findByPlaceholderText(/Lọc danh mục/), 'mot cai gi do')

    await waitFor(() => expect(screen.queryByRole('button', { name: /Tải về/ })).toBeNull())
  })

  it('lỗi của service hiện nguyên văn cho người dùng đọc', async () => {
    const svc = fakeService()
    svc.override = (route) =>
      route === 'POST /api/models/download'
        ? errorResponse(404, 'Không có repo đó trên HuggingFace.')
        : null
    renderScreen(<ModelsScreen />)

    await userEvent.type(await screen.findByPlaceholderText(/Lọc danh mục/), 'go-nham/khong-co')
    await userEvent.click(await screen.findByRole('button', { name: /Tải về/ }))

    // Màn hình hiện thẳng `error.message`; nuốt mất `detail` là người dùng chỉ thấy
    // "HTTP 404" và không biết phải sửa gì.
    expect(await screen.findByText('Không có repo đó trên HuggingFace.')).toBeTruthy()
  })
})

describe('bộ tự chọn', () => {
  it('ô chọn model chỉ hiện model của runtime đang chọn', async () => {
    const svc = fakeService()
    svc.config = { ...svc.config, preset: 'custom' }
    renderScreen(<ModelsScreen />)

    const runtime = (await screen.findByLabelText('Runtime ASR')) as HTMLSelectElement
    const model = screen.getByLabelText('Model ASR') as HTMLSelectElement
    expect([...model.options].map((o) => o.value)).toEqual([
      'ggml-tiny-q5_1.bin',
      'ggml-small-q5_1.bin'
    ])

    await userEvent.selectOptions(runtime, 'mlx_whisper')

    // Đổi runtime là đổi luôn họ model — danh sách phải theo ngay, không chờ lưu.
    await waitFor(() =>
      expect([...(screen.getByLabelText('Model ASR') as HTMLSelectElement).options]).toHaveLength(1)
    )
    expect((screen.getByLabelText('Model ASR') as HTMLSelectElement).options[0].value).toBe(
      'mlx-community/whisper-tiny-asr-4bit'
    )
  })

  it('chỉ chào runtime ASR mà service báo là cài được', async () => {
    // Bản đóng gói có thể không kèm MLX/faster-whisper, nên service lọc danh sách
    // trước khi trả về. Màn hình phải vẽ đúng thứ nhận được — chào một runtime
    // không có thì người dùng bấm vào và ăn "Nạp model thất bại".
    const svc = fakeService()
    svc.config = {
      ...svc.config,
      preset: 'custom',
      custom: {
        asrAdapter: 'whisper_cpp',
        asrModel: 'ggml-small-q5_1.bin',
        mtModel: 'facebook/nllb-200-distilled-600M',
        asrAdapterChoices: ['whisper_cpp'],
        asrModelChoices: { whisper_cpp: ['ggml-tiny-q5_1.bin', 'ggml-small-q5_1.bin'] },
        mtModelChoices: ['facebook/nllb-200-distilled-600M']
      }
    }
    renderScreen(<ModelsScreen />)

    const runtime = (await screen.findByLabelText('Runtime ASR')) as HTMLSelectElement
    expect([...runtime.options].map((o) => o.value)).toEqual(['whisper_cpp'])
  })

  it('chọn model chỉ là bản nháp, phải bấm Lưu mới gửi lên service', async () => {
    const svc = fakeService()
    svc.config = { ...svc.config, preset: 'custom' }
    renderScreen(<ModelsScreen />)

    await userEvent.selectOptions(await screen.findByLabelText('Runtime ASR'), 'faster_whisper')
    const putsBefore = svc.callsTo('/api/config').filter((c) => c.method === 'PUT').length
    expect(putsBefore).toBe(0)

    await userEvent.click(screen.getByRole('button', { name: /Lưu lựa chọn/ }))

    await waitFor(() => {
      const puts = svc.callsTo('/api/config').filter((c) => c.method === 'PUT')
      expect(puts).toHaveLength(1)
      // Gửi CẢ model, không chỉ runtime: thứ lưu xuống phải đúng bằng thứ đang hiện
      // trên màn hình, chứ không phải mặc định nào đó service tự chọn thay.
      expect(puts[0].body).toMatchObject({
        customAsrAdapter: 'faster_whisper',
        customAsrModel: 'Systran/faster-whisper-small'
      })
    })
  })

  it('đổi runtime KHÔNG để lại model của runtime cũ đang được chọn sẵn', async () => {
    // Trước đây ô model rơi về giá trị service đang giữ — model của runtime CŨ — nên
    // người dùng nhìn thấy sẵn một tổ hợp không tồn tại và bấm Lưu là ăn 400.
    const svc = fakeService()
    svc.config = { ...svc.config, preset: 'custom' }
    renderScreen(<ModelsScreen />)

    await userEvent.selectOptions(await screen.findByLabelText('Runtime ASR'), 'mlx_whisper')

    const model = screen.getByLabelText('Model ASR') as HTMLSelectElement
    expect(model.value).toBe('mlx-community/whisper-tiny-asr-4bit')
    expect([...model.options].map((o) => o.value)).not.toContain('ggml-small-q5_1.bin')
  })
})

describe('service không chạy', () => {
  it('nói rõ lý do thay vì để cả màn hình mờ đi không giải thích', async () => {
    fakeService({ up: false })
    renderScreen(<ModelsScreen />)

    expect(await screen.findByText(/Không kết nối được AI service/)).toBeTruthy()
    // Không có service thì không có nút nạp nào để bấm.
    expect(screen.queryByRole('button', { name: /Khởi động model/ })).toBeNull()
  })
})
