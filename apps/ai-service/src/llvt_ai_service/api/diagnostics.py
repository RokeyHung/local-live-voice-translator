"""REST: đo độ trễ pipeline và tài nguyên tiến trình (phục vụ Tuần 8)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from llvt_ai_service.api.deps import get_container
from llvt_ai_service.application.benchmark import run_benchmark
from llvt_ai_service.application.container import Container
from llvt_ai_service.application.resources import read_usage
from llvt_ai_service.domain.enums import Language
from llvt_ai_service.schemas import BenchmarkRequest, BenchmarkResponse, ResourceResponse

router = APIRouter(prefix="/api", tags=["diagnostics"])


@router.post("/benchmark", response_model=BenchmarkResponse)
async def benchmark(
    body: BenchmarkRequest | None = None, container: Container = Depends(get_container)
) -> BenchmarkResponse:
    """Chạy một câu mẫu qua từng khâu và trả thời gian thực tế của máy này."""
    request = body or BenchmarkRequest()
    result = await run_benchmark(
        container.model_manager.providers,
        Language(request.source),
        Language(request.target),
    )
    return BenchmarkResponse(
        vadMs=result.vad_ms,
        asrMs=result.asr_ms,
        mtMs=result.mt_ms,
        ttsMs=result.tts_ms,
        totalMs=result.total_ms,
        audioMs=result.audio_ms,
        source=result.source,
        target=result.target,
        preset=container.model_manager.preset,
    )


@router.get("/resources", response_model=ResourceResponse)
def resources() -> ResourceResponse:
    usage = read_usage()
    return ResourceResponse(
        cpuPercent=usage.cpu_percent,
        cpuCount=usage.cpu_count,
        rssMb=usage.rss_mb,
        systemTotalMb=usage.system_total_mb,
        systemUsedPercent=usage.system_used_percent,
        threads=usage.threads,
    )
