// Hook cầu nối: lịch sử phiên nằm bên AI service (SQLite) qua TanStack Query.
//
// Trong lúc một phiên đang chạy, service ghi thêm câu vào DB sau mỗi utterance nên
// danh sách được hỏi lại theo nhịp ngắn để phần "đang ghi" hiện gần như tức thời.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { HttpAiClient } from '../adapters/http-ai-client'
import type { HistorySession, HistorySessionDetail } from '../domain/models'
import type { AiClient } from '../ports/ai-client'

const client: AiClient = new HttpAiClient()

const LIVE_REFETCH_MS = 2000

export function useSessions(query: string, live: boolean): UseQueryResult<HistorySession[], Error> {
  return useQuery({
    queryKey: ['sessions', query],
    queryFn: () => client.fetchSessions(query),
    refetchInterval: live ? LIVE_REFETCH_MS : false,
    retry: false
  })
}

export function useSessionDetail(
  id: string | null,
  live: boolean
): UseQueryResult<HistorySessionDetail, Error> {
  return useQuery({
    queryKey: ['session', id],
    queryFn: () => client.fetchSession(id as string),
    enabled: id != null,
    refetchInterval: live ? LIVE_REFETCH_MS : false,
    retry: false
  })
}

export function useRenameSession(): UseMutationResult<
  HistorySession,
  Error,
  { id: string; title: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }) => client.renameSession(id, title),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['session', id] })
    }
  })
}

// Đóng phiên bị bỏ dở từ dải nhắc khôi phục (xem RecoveryBanner).
export function useCloseSession(): UseMutationResult<HistorySession, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => client.closeSession(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['session', id] })
    }
  })
}

export function useDeleteSession(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => client.deleteSession(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.removeQueries({ queryKey: ['session', id] })
    }
  })
}

export function useDeleteAllSessions(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => client.deleteAllSessions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.removeQueries({ queryKey: ['session'] })
    }
  })
}
