// Hook cầu nối: preset đang chạy bên AI service (GET/PUT /api/config).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { HttpAiClient } from '../adapters/http-ai-client'
import { formatBytes } from '../application/format'
import { format } from '../application/i18n'
import { logInfo, logWarn } from '../application/logger'
import type { Language, Preset } from '../domain/enums'
import type {
  BenchmarkResponse,
  ConfigResponse,
  DeletedModels,
  DownloadedModel,
  HfVerifyResult,
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
    onSuccess: (data) => {
      queryClient.setQueryData(['config'], data)
      logInfo('models', (L) => format(L.logPresetChanged, { preset: data.preset }))
    },
    onError: (error) => logWarn('models', (L) => format(L.logModelsFailed, { msg: error.message })),
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
    onMutate: () => logInfo('models', (L) => L.logModelsLoading),
    onSuccess: (data) => {
      queryClient.setQueryData(['config'], data)
      void queryClient.invalidateQueries({ queryKey: ['installed-models'] })
      void queryClient.invalidateQueries({ queryKey: ['storage'] })
      logInfo('models', (L) => L.logModelsReady)
    },
    onError: (error) => logWarn('models', (L) => format(L.logModelsFailed, { msg: error.message })),
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
    onSuccess: (data) => {
      queryClient.setQueryData(['config'], data)
      logInfo('models', (L) => L.logModelsUnloaded)
    }
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
      void queryClient.invalidateQueries({ queryKey: ['storage'] })
      logInfo('storage', (L) => format(L.logModelsDirChanged, { dir: data.modelsDir }))
    }
  })
}

// Lưu / gỡ access token HuggingFace. Không đụng tới model đang nạp: token chỉ có
// tác dụng cho lần *tải* kế tiếp.
export function useSetHfToken(): UseMutationResult<
  ConfigResponse,
  Error,
  { preset: Preset; token: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ preset, token }) => client.setHfToken(preset, token),
    onSuccess: (data) => {
      queryClient.setQueryData(['config'], data)
      // Nhật ký chỉ ghi việc đã đổi, KHÔNG ghi giá trị token.
      logInfo('app', (L) => (data.hfTokenSet ? L.logHfTokenSaved : L.logHfTokenCleared))
    }
  })
}

// Hỏi huggingface.co xem token dùng được không. Không cache: người dùng bấm là muốn
// hỏi lại thật, và token có thể vừa bị thu hồi.
export function useVerifyHfToken(): UseMutationResult<HfVerifyResult, Error, string> {
  return useMutation({
    mutationFn: (token: string) => client.verifyHfToken(token),
    retry: false
  })
}

// Dừng lượt nạp đang chạy. Không invalidate gì: `POST /api/models/load` sẽ tự trả
// 409 và cập nhật lại cấu hình khi nó thoát.
export function useCancelLoadModels(): UseMutationResult<void, Error, void> {
  return useMutation({ mutationFn: () => client.cancelLoadModels(), retry: false })
}

// Tải một model trong danh mục về đĩa (không nạp vào bộ nhớ, không đổi preset).
export function useDownloadModel(): UseMutationResult<DownloadedModel, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    // Tải hàng GB trong một request — đừng tự thử lại, sẽ tải chồng lên nhau.
    mutationFn: (name: string) => client.downloadModel(name),
    retry: false,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['installed-models'] })
      void queryClient.invalidateQueries({ queryKey: ['storage'] })
      logInfo('models', (L) => format(L.logModelDownloaded, { name: data.name }))
    }
  })
}

// Xoá đúng một model đã tải.
export function useDeleteInstalledModel(): UseMutationResult<DeletedModels, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (path: string) => client.deleteInstalledModel(path),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['installed-models'] })
      void queryClient.invalidateQueries({ queryKey: ['storage'] })
      logInfo('models', (L) => format(L.logModelDeleted, { size: formatBytes(data.freedBytes) }))
    }
  })
}

// Lưu lựa chọn model cho preset 'custom'.
export function useSetCustomModels(): UseMutationResult<
  ConfigResponse,
  Error,
  { preset: Preset; choice: { asrAdapter?: string; asrModel?: string; mtModel?: string } }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ preset, choice }) => client.setCustomModels(preset, choice),
    onSuccess: (data) => queryClient.setQueryData(['config'], data)
  })
}

export function useDeleteInstalledModels(): UseMutationResult<DeletedModels, Error, void> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => client.deleteInstalledModels(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['installed-models'] })
      void queryClient.invalidateQueries({ queryKey: ['config'] })
      void queryClient.invalidateQueries({ queryKey: ['storage'] })
      logWarn('storage', (L) => format(L.logModelsDeleted, { size: formatBytes(data.freedBytes) }))
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
    mutationFn: ({ source, target }) => client.runBenchmark(source, target),
    onSuccess: (data) =>
      logInfo('benchmark', (L) => format(L.logBenchDone, { total: Math.round(data.totalMs) })),
    onError: (error) =>
      logWarn('benchmark', (L) => format(L.logBenchFailed, { msg: error.message }))
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
