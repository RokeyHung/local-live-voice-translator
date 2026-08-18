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


@router.post(
    "/benchmark",
    response_model=BenchmarkResponse,
    summary="Đo độ trễ từng khâu",
    description=(
        "Chạy VAD/ASR trên một đoạn sóng tổng hợp 3 giây và MT/TTS trên một câu mẫu, "
        "mỗi khâu với đầu vào cố định nên số đo không phụ thuộc chất lượng khâu trước.\n\n"
        "**Luôn warm-up trước khi bấm giờ.** TTS nạp voice lười theo ngôn ngữ và lần "
        "suy luận đầu của ASR/MT tốn thêm thời gian dựng graph — đo nguội sẽ ra con số "
        "vô nghĩa (thực đo: 34.7 s lần đầu so với 1.7 s các lần sau). Kết quả vì thế là "
        "độ trễ mỗi câu khi máy đã chạy ổn định, KHÔNG gồm thời gian khởi động.\n\n"
        "Đây là phép đo thời gian, không phải độ chính xác — dùng `scripts/accuracy.py` "
        "cho phần đó. `ttsMs = null` nghĩa là máy chưa tải được voice cho ngôn ngữ đích."
    ),
)
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


@router.get(
    "/resources",
    response_model=ResourceResponse,
    summary="Tài nguyên tiến trình service",
    description=(
        "CPU% và RSS của chính tiến trình Python, đọc bằng psutil. Renderer nằm trong "
        "sandbox Chromium nên không tự đo được phần này. Không đo VRAM: Apple Silicon "
        "dùng bộ nhớ hợp nhất (đã nằm trong RSS)."
    ),
)
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
