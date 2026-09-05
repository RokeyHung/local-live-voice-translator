// Hook cầu nối cho màn Đánh giá (POST /api/evaluate).

import { useMutation, useQuery } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { HttpAiClient } from '../adapters/http-ai-client'
import { format } from '../application/i18n'
import { logInfo, logWarn } from '../application/logger'
import type { EvaluationCase, EvaluationProgress, EvaluationResult } from '../domain/models'
import type { AiClient } from '../ports/ai-client'

const client: AiClient = new HttpAiClient()

/** Bộ câu mẫu đi kèm service. Hỏi một lần rồi giữ: nó là file tĩnh trên đĩa. */
export function useEvaluationCorpus(enabled: boolean): UseQueryResult<EvaluationCase[], Error> {
  return useQuery({
    queryKey: ['evaluation-corpus'],
    queryFn: () => client.fetchEvaluationCorpus(),
    staleTime: Infinity,
    retry: false,
    enabled
  })
}

export function useRunEvaluation(): UseMutationResult<
  EvaluationResult,
  Error,
  { cases: EvaluationCase[]; limit?: number }
> {
  return useMutation({
    // Cả bộ chạy trong một request — vài phút với bộ lớn, nên đừng đặt timeout hay tự
    // thử lại (thử lại sẽ chạy lại từ đầu và tốn gấp đôi thời gian model).
    mutationFn: ({ cases, limit }) => client.runEvaluation(cases, limit),
    retry: false,
    onMutate: ({ cases }) =>
      logInfo('evaluate', (L) => format(L.logEvalStart, { n: cases.length })),
    onSuccess: (result) =>
      logInfo('evaluate', (L) =>
        format(L.logEvalDone, {
          n: result.cases.length,
          err: `${(result.errorRate * 100).toFixed(1)}%`,
          chrf: `${(result.chrf * 100).toFixed(1)}%`
        })
      ),
    onError: (error) => logWarn('evaluate', (L) => format(L.logEvalFailed, { msg: error.message }))
  })
}

/** Chỉ hỏi trong lúc đang chạy; nhịp giống tiến trình nhập tệp. */
export function useEvaluationProgress(enabled: boolean): UseQueryResult<EvaluationProgress, Error> {
  return useQuery({
    queryKey: ['evaluation-progress'],
    queryFn: () => client.fetchEvaluationProgress(),
    refetchInterval: 700,
    retry: false,
    enabled
  })
}

export function useCancelEvaluation(): UseMutationResult<void, Error, void> {
  return useMutation({ mutationFn: () => client.cancelEvaluation(), retry: false })
}
