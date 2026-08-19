// Hook cầu nối: preset đang chạy bên AI service (GET/PUT /api/config).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { HttpAiClient } from '../adapters/http-ai-client'
import type { Language, Preset } from '../domain/enums'
import type {
  BenchmarkResponse,
  ConfigResponse,
  DeletedModels,
  InstalledModel,
  LoadProgress,
  ResourceResponse
} from '../domain/models'
import type { AiClient } from '../ports/ai-client'

const client: AiClient = new HttpAiClient()

const LOAD_PROGRESS_KEY = ['load-progress']

// Lấy ảnh chụp cuối cùng của tiến trình khi lệnh nạp kết thúc.
//
// Query tiến trình chỉ bật trong lúc đang nạp, mà react-query giữ lại dữ liệu cũ của
// query đã tắt — không kéo lần cuối thì bảng đứng hình ở lần hỏi áp chót ("MT đang
// nạp", "TTS chờ") dù model đã xong. `invalidateQueries` không đủ vì query đang tắt
// thì không tự chạy lại, nên phải `fetchQuery` thẳng.
function refreshProgress(queryClient: QueryClient): void {
  void queryClient.fetchQuery({
    queryKey: LOAD_PROGRESS_KEY,
    queryFn: () => client.fetchLoadProgress()
  })
}

export function useServiceConfig(): UseQueryResult<ConfigResponse, Error> {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => client.fetchConfig(),
    // Model có thể được nạp từ nơi khác (bắt đầu phiên, chạy benchmark) nên hỏi lại
    // theo nhịp chậm để chỉ báo "đã nạp / chưa nạp" không bị đứng hình.
    refetchInterval: 5000,
    retry: false
  })
}

export function useSetPreset(): UseMutationResult<ConfigResponse, Error, Preset> {
  const queryClient = useQueryClient()
  return useMutation({
    // Đổi preset khiến service nạp lại model — có thể mất vài giây.
    mutationFn: (preset: Preset) => client.updatePreset(preset),
    onSuccess: (data) => queryClient.setQueryData(['config'], data),
    onSettled: () => refreshProgress(queryClient)
  })
}

// Bật/tắt lưu lịch sử phiên (SPEC 14.4). Không nạp lại model nên phản hồi ngay.
export function useSetHistoryEnabled(): UseMutationResult<
  ConfigResponse,
  Error,
  { preset: Preset; enabled: boolean }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ preset, enabled }) => client.setHistoryEnabled(preset, enabled),
    onSuccess: (data) => queryClient.setQueryData(['config'], data)
  })
}

// Nạp model theo yêu cầu ("Khởi động model"/"Nạp lại"). Lần đầu có thể mất vài phút
// vì còn tải model về, nên đừng đặt timeout hay tự thử lại.
export function useLoadModels(): UseMutationResult<ConfigResponse, Error, boolean | void> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reload) => client.loadModels(reload === true),
    onSuccess: (data) => {
      queryClient.setQueryData(['config'], data)
      void queryClient.invalidateQueries({ queryKey: ['installed-models'] })
    },
    // Cả khi hỏng cũng phải cập nhật: bảng tiến trình là chỗ chỉ ra khâu nào chết.
    onSettled: () => refreshProgress(queryClient)
  })
}

// Tiến trình nạp model. Chỉ hỏi trong lúc đang nạp; nhịp nhanh hơn các query khác vì
// đây là thứ người dùng đang nhìn chằm chằm, nhưng vẫn chậm hơn chu kỳ lấy mẫu của
// service (0,5 s) để không hỏi lại cùng một con số.
export function useLoadProgress(enabled: boolean): UseQueryResult<LoadProgress, Error> {
  return useQuery({
    queryKey: LOAD_PROGRESS_KEY,
    queryFn: () => client.fetchLoadProgress(),
    refetchInterval: 700,
    retry: false,
    enabled
  })
}

export function useUnloadModels(): UseMutationResult<ConfigResponse, Error, void> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => client.unloadModels(),
    onSuccess: (data) => queryClient.setQueryData(['config'], data)
  })
}

// Đổi thư mục lưu model. Service giải phóng model đang nạp nên phải làm mới cả
// cấu hình lẫn danh sách model trên đĩa.
export function useSetModelsDir(): UseMutationResult<
  ConfigResponse,
  Error,
  { preset: Preset; dir: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ preset, dir }) => client.setModelsDir(preset, dir),
    onSuccess: (data) => {
      queryClient.setQueryData(['config'], data)
      void queryClient.invalidateQueries({ queryKey: ['installed-models'] })
    }
  })
}

export function useDeleteInstalledModels(): UseMutationResult<DeletedModels, Error, void> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => client.deleteInstalledModels(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['installed-models'] })
      void queryClient.invalidateQueries({ queryKey: ['config'] })
    }
  })
}

// Đo độ trễ theo yêu cầu (không tự chạy: mỗi lần đo tốn vài giây model thật).
export function useBenchmark(): UseMutationResult<
  BenchmarkResponse,
  Error,
  { source: Language; target: Language }
> {
  return useMutation({
    mutationFn: ({ source, target }) => client.runBenchmark(source, target)
  })
}

// Tài nguyên tiến trình service; chỉ hỏi khi đang mở màn Chẩn đoán.
export function useResources(enabled: boolean): UseQueryResult<ResourceResponse, Error> {
  return useQuery({
    queryKey: ['resources'],
    queryFn: () => client.fetchResources(),
    refetchInterval: 2000,
    retry: false,
    enabled
  })
}

// Model đã tải trên đĩa; quét thư mục nên đừng hỏi liên tục.
export function useInstalledModels(enabled: boolean): UseQueryResult<InstalledModel[], Error> {
  return useQuery({
    queryKey: ['installed-models'],
    queryFn: () => client.fetchInstalledModels(),
    staleTime: 30_000,
    retry: false,
    enabled
  })
}
