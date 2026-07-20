// Hook cầu nối: REST /health qua TanStack Query.

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { HttpAiClient } from '../adapters/http-ai-client'
import type { HealthResponse } from '../domain/models'
import type { AiClient } from '../ports/ai-client'

const client: AiClient = new HttpAiClient()

export function useHealth(): UseQueryResult<HealthResponse, Error> {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => client.fetchHealth(),
    refetchInterval: 5000,
    retry: false
  })
}
