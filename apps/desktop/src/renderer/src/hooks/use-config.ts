// Hook cầu nối: preset đang chạy bên AI service (GET/PUT /api/config).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { HttpAiClient } from '../adapters/http-ai-client'
import type { Language, Preset } from '../domain/enums'
import type {
  BenchmarkResponse,
  ConfigResponse,
  DeletedModels,
  InstalledModel,
  ResourceResponse
} from '../domain/models'
import type { AiClient } from '../ports/ai-client'

const client: AiClient = new HttpAiClient()

export function useServiceConfig(): UseQueryResult<ConfigResponse, Error> {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => client.fetchConfig(),
    retry: false
  })
}

export function useSetPreset(): UseMutationResult<ConfigResponse, Error, Preset> {
  const queryClient = useQueryClient()
  return useMutation({
    // Đổi preset khiến service nạp lại model — có thể mất vài giây.
    mutationFn: (preset: Preset) => client.updatePreset(preset),
    onSuccess: (data) => queryClient.setQueryData(['config'], data)
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
