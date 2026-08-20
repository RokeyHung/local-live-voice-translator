// Hook cầu nối cho màn Nhập tệp: chạy một tệp qua POST /api/transcribe và hỏi tiến
// trình song song trong lúc lệnh đó còn chặn (cùng cách làm với tiến trình nạp model).

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { HttpAiClient } from '../adapters/http-ai-client'
import { format } from '../application/i18n'
import { logInfo, logWarn } from '../application/logger'
import type { TranscribeProgress, TranscriptionResult } from '../domain/models'
import type { AiClient, TranscribeRequest } from '../ports/ai-client'

const client: AiClient = new HttpAiClient()

export function useTranscribeFile(): UseMutationResult<
  TranscriptionResult,
  Error,
  TranscribeRequest
> {
  const queryClient = useQueryClient()
  return useMutation({
    // Cả tệp chạy trong một request — vài phút với tệp dài, nên đừng đặt timeout
    // hay tự thử lại (thử lại sẽ dịch lại từ đầu và ghi trùng vào lịch sử).
    mutationFn: (request: TranscribeRequest) => client.transcribeFile(request),
    retry: false,
    onMutate: (request) =>
      logInfo('import', (L) => format(L.logImportStart, { name: request.name })),
    onSuccess: (result, request) => {
      // Kết quả được lưu thành một phiên → màn Lịch sử phải thấy ngay.
      if (result.sessionId) void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      logInfo('import', (L) =>
        format(L.logImportDone, { name: request.name, count: result.segments.length })
      )
    },
    onError: (error, request) =>
      logWarn('import', (L) =>
        format(L.logImportFailed, { name: request.name, msg: error.message })
      )
  })
}

// Xin dừng tệp đang chạy. Không huỷ request đang bay: service dừng ở khúc kế tiếp rồi
// trả về phần đã chạy được, nên người dùng vẫn giữ được đoạn đã dịch xong.
export function useCancelTranscribe(): UseMutationResult<void, Error, void> {
  return useMutation({
    mutationFn: () => client.cancelTranscribe(),
    onSuccess: () => logWarn('import', (L) => L.logImportCancelled)
  })
}

// Chỉ hỏi khi đang chạy; nhịp nhanh hơn các query khác vì người dùng đang nhìn thanh
// tiến trình, giống useLoadProgress ở màn Quản lý model.
export function useTranscribeProgress(enabled: boolean): UseQueryResult<TranscribeProgress, Error> {
  return useQuery({
    queryKey: ['transcribe-progress'],
    queryFn: () => client.fetchTranscribeProgress(),
    refetchInterval: 700,
    retry: false,
    enabled
  })
}
