// Hook cầu nối: preset đang chạy bên AI service (GET/PUT /api/config).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { HttpAiClient } from '../adapters/http-ai-client'
import type { Preset } from '../domain/enums'
import type { ConfigResponse } from '../domain/models'
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
