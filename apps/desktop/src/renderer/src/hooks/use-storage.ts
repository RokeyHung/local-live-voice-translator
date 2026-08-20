// Hook cầu nối cho khối "Thư mục dữ liệu ứng dụng": dung lượng đĩa của từng kho.
//
// Hai nguồn khác nhau vì hai kho thuộc hai tiến trình: model và lịch sử là của AI
// service (GET /api/storage), còn cache là của chính Electron (đo qua preload).
//
// KHÔNG đặt refetchInterval: đo model là rglob toàn bộ thư mục vài GB, quét lại mỗi
// vài giây chỉ để một con số ít khi đổi là quá đắt. Chỉ hỏi lại khi mở màn Cài đặt
// hoặc sau khi vừa dọn một kho.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { HttpAiClient } from '../adapters/http-ai-client'
import { cacheBytes, clearCache } from '../application/config'
import { logInfo } from '../application/logger'
import type { StorageUsage } from '../domain/models'
import type { AiClient } from '../ports/ai-client'

const client: AiClient = new HttpAiClient()

export function useStorageUsage(enabled: boolean): UseQueryResult<StorageUsage, Error> {
  return useQuery({
    queryKey: ['storage'],
    queryFn: () => client.fetchStorage(),
    staleTime: 30_000,
    retry: false,
    enabled
  })
}

export function useCacheBytes(enabled: boolean): UseQueryResult<number, Error> {
  return useQuery({
    queryKey: ['cache-bytes'],
    queryFn: () => cacheBytes(),
    staleTime: 30_000,
    retry: false,
    enabled
  })
}

export function useClearCache(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => clearCache(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cache-bytes'] })
      logInfo('storage', (L) => L.logCacheCleared)
    }
  })
}
