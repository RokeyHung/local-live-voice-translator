// Hook cầu nối: preset đang chạy bên AI service (GET/PUT /api/config).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { HttpAiClient } from '../adapters/http-ai-client'
import type { Language, Preset } from '../domain/enums'
import type { BenchmarkResponse, ConfigResponse, ResourceResponse } from '../domain/models'
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
