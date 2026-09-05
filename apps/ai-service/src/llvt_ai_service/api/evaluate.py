"""REST: chạy bộ câu mẫu qua hệ thống và tự chấm điểm (màn "Đánh giá").

GVHD giao ở biên bản 19/08 mục 3d. Cùng lối với `api/transcribe.py`: lệnh chạy **chặn
tới khi xong**, tiến trình hỏi song song, và huỷ được ở ranh giới câu.
"""

from __future__ import annotations

import json
import logging
import wave
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request

from llvt_ai_service.api.deps import get_container
from llvt_ai_service.application.container import Container
from llvt_ai_service.application.evaluation import EvaluationCase, evaluate, progress
from llvt_ai_service.application.model_manager import ModelLoadError
from llvt_ai_service.domain.enums import Language
from llvt_ai_service.schemas import (
    EvaluationCaseResultSchema,
    EvaluationCaseSchema,
    EvaluationProgressResponse,
    EvaluationRequest,
    EvaluationResponse,
)

logger = logging.getLogger("llvt.api.evaluate")

router = APIRouter(prefix="/api", tags=["evaluate"])

# Bộ câu mẫu đi kèm service — cùng file mà `make accuracy` dùng, nên chạy trong app và
# chạy bằng CLI là chạy đúng một bộ dữ liệu, không phải hai bản chép tay.
BUNDLED_CORPUS = Path(__file__).resolve().parents[3] / "scripts" / "accuracy_corpus.json"

# Trần số câu một lượt. Mỗi câu chạy cả ASR lẫn MT nên 200 câu đã là hàng chục phút;
# quá đó thì dùng `make eval-asr` (chạy nền, ghi ra JSON) chứ đừng giữ một request mở.
MAX_CASES = 200


def _load_bundled() -> list[EvaluationCaseSchema]:
    """Đọc bộ câu mẫu đi kèm; thiếu file thì trả rỗng chứ không làm chết service."""
    try:
        data = json.loads(BUNDLED_CORPUS.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.warning("Không đọc được bộ câu mẫu %s", BUNDLED_CORPUS, exc_info=True)
        return []
    out: list[EvaluationCaseSchema] = []
    for case in data.get("cases", []):
        audio = str(case.get("audio") or "")
        out.append(
            EvaluationCaseSchema(
                id=str(case.get("id", "")),
                language=Language(case["language"]),
                target=Language(case["target"]),
                transcript=str(case.get("transcript", "")),
                translation=str(case.get("translation", "")),
                # Đường dẫn trong file mẫu là tương đối so với chính nó.
                audio=str((BUNDLED_CORPUS.parent / audio).resolve()) if audio else "",
            )
        )
    return out


def _read_wav_16k_mono(path: Path) -> bytes:
    """Đọc WAV PCM 16-bit mono 16 kHz. Định dạng khác thì báo lỗi thay vì đoán."""
    with wave.open(str(path), "rb") as wav:
        if wav.getsampwidth() != 2 or wav.getnchannels() != 1 or wav.getframerate() != 16000:
            raise ValueError(
                f"{path.name}: cần WAV PCM 16-bit mono 16 kHz "
                f"(đang là {wav.getnchannels()} kênh, {wav.getframerate()} Hz)"
            )
        return wav.readframes(wav.getnframes())


def _to_domain(schema: EvaluationCaseSchema) -> EvaluationCase:
    pcm = b""
    if schema.audio:
        path = Path(schema.audio).expanduser()
        if not path.is_absolute():
            raise HTTPException(
                status_code=400,
                detail=f"{schema.id}: `audio` phải là đường dẫn tuyệt đối.",
            )
        if not path.is_file():
            # Khai báo file rồi mà sai đường dẫn thì phải BÁO, không được lặng lẽ rơi
            # về giọng tổng hợp — người chạy sẽ tưởng mình đang có số đo giọng thật.
            raise HTTPException(status_code=400, detail=f"{schema.id}: không thấy {path}")
        try:
            pcm = _read_wav_16k_mono(path)
        except (OSError, ValueError, wave.Error) as exc:
            raise HTTPException(status_code=400, detail=f"{schema.id}: {exc}") from exc
    return EvaluationCase(
        id=schema.id,
        language=schema.language,
        target=schema.target,
        transcript=schema.transcript,
        translation=schema.translation,
        pcm=pcm,
    )


@router.get(
    "/evaluate/corpus",
    response_model=list[EvaluationCaseSchema],
    summary="Bộ câu mẫu đi kèm service",
    description=(
        "Đúng bộ câu mà `make accuracy` dùng (`scripts/accuracy_corpus.json`), để màn "
        "Đánh giá có sẵn thứ chạy được ngay. Câu nào có `audio` là đã kèm bản ghi "
        "giọng thật; câu nào để trống thì lượt chạy sẽ dùng giọng tổng hợp.\n\n"
        "Giá trị của số liệu nằm ở chỗ **thay bộ này bằng câu thoại họp thật của bạn** "
        "— gửi bộ câu riêng qua `cases` của `POST /api/evaluate`."
    ),
)
def bundled_corpus() -> list[EvaluationCaseSchema]:
    return _load_bundled()


@router.post(
    "/evaluate",
    response_model=EvaluationResponse,
    summary="Chạy bộ câu mẫu và chấm điểm",
    description=(
        "Mỗi câu chạy `ASR` trên phần audio rồi `MT` trên **câu tham chiếu** (không "
        "phải trên đầu ra ASR — làm vậy thì lỗi hai khâu cộng dồn và không biết chất "
        "lượng dịch thật sự là bao nhiêu).\n\n"
        "Chấm: **WER** cho vi/en, **CER** cho zh/ja (hai thứ tiếng đó không tách từ "
        "bằng khoảng trắng), và **chrF** cho bản dịch. Độ trễ báo **p50/p90** cùng "
        "RTF p90 — trung bình che mất đúng những câu chậm mà người dùng cảm nhận được."
        "\n\nCâu không có `audio` sẽ được đọc bằng chính TTS của hệ thống rồi cho ASR "
        "nghe lại. Tiện để thử pipeline, nhưng số sẽ **lạc quan hơn thực tế** vì giọng "
        "tổng hợp sạch và đều — kết quả trả về cờ `hasSyntheticAudio` để giao diện nói "
        "rõ chuyện đó.\n\n"
        "Lệnh **chặn tới khi xong**; hỏi `GET /api/evaluate/progress` song song, và "
        "`POST /api/evaluate/cancel` để dừng — khi đó lệnh trả về bình thường với "
        "`cancelled: true` và phần đã chạy được.\n\n"
        "Số ở đây **không thay thế** `make eval-asr`/`make eval-mt`: bộ script đó dùng "
        "jiwer + spBLEU nên so được với số công bố của NLLB-200, còn màn hình này để "
        "thử nhanh và so các cấu hình với nhau."
    ),
)
async def run_evaluation(
    request: Request,
    body: EvaluationRequest,
    container: Container = Depends(get_container),
) -> EvaluationResponse:
    if progress.active:
        raise HTTPException(status_code=409, detail="Đang chạy một lượt đánh giá khác.")

    cases = body.cases or _load_bundled()
    if not cases:
        raise HTTPException(status_code=400, detail="Không có câu nào để chấm.")
    if body.limit is not None and body.limit > 0:
        cases = cases[: body.limit]
    if len(cases) > MAX_CASES:
        raise HTTPException(
            status_code=400,
            detail=f"Tối đa {MAX_CASES} câu một lượt; bộ lớn hơn thì dùng `make eval-asr`.",
        )

    domain_cases = [_to_domain(case) for case in cases]
    try:
        providers = await container.model_manager.ensure_loaded()
    except ModelLoadError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Không nạp được model cho khâu {exc.stage}. Lần đầu cần mạng để tải "
                f"model — kiểm tra kết nối rồi thử lại. Chi tiết: {exc.cause}"
            ),
        ) from exc

    async def should_stop() -> bool:
        # Người dùng bấm Huỷ, hoặc đóng app giữa chừng (uvicorn không tự huỷ handler).
        return progress.cancel_requested or await request.is_disconnected()

    report = await evaluate(providers, domain_cases, should_stop=should_stop)
    logger.info(
        "Đánh giá %d câu: %s trung bình %.3f, chrF %.1f%s",
        len(report.cases),
        report.cases[0].metric if report.cases else "—",
        report.error_rate,
        report.chrf,
        " (dừng giữa chừng)" if report.cancelled else "",
    )
    return EvaluationResponse(
        cases=[
            EvaluationCaseResultSchema(
                id=c.id,
                language=Language(c.language),
                target=Language(c.target),
                audioSource=c.audio_source,
                reference=c.reference,
                hypothesis=c.hypothesis,
                errorRate=c.error_rate,
                metric=c.metric,
                referenceTranslation=c.reference_translation,
                translation=c.translation,
                chrf=c.chrf,
                asrMs=c.asr_ms,
                mtMs=c.mt_ms,
                audioMs=c.audio_ms,
            )
            for c in report.cases
        ],
        errorRate=report.error_rate,
        chrf=report.chrf,
        asrP50Ms=report.asr_p50_ms,
        asrP90Ms=report.asr_p90_ms,
        mtP50Ms=report.mt_p50_ms,
        mtP90Ms=report.mt_p90_ms,
        totalP90Ms=report.total_p90_ms,
        rtfP90=report.rtf_p90,
        hasSyntheticAudio=report.has_synthetic_audio,
        cancelled=report.cancelled,
    )


@router.post(
    "/evaluate/cancel",
    status_code=204,
    summary="Dừng lượt đánh giá đang chạy",
    description=(
        "Dừng ở ranh giới **câu kế tiếp**; `POST /api/evaluate` trả về bình thường với "
        "`cancelled: true` và số của những câu đã chạy xong — vứt đi thì phí.\n\n"
        "Không có gì đang chạy thì lệnh này không làm gì cả (không phải lỗi)."
    ),
)
def cancel_evaluation() -> None:
    progress.request_cancel()


@router.get(
    "/evaluate/progress",
    response_model=EvaluationProgressResponse,
    summary="Tiến trình lượt đánh giá",
    description=(
        "Hỏi song song trong lúc `POST /api/evaluate` còn đang chặn. `percent` tính "
        "theo **số câu đã chạy xong**, không phải theo thời gian ước lượng."
    ),
)
def evaluation_progress() -> EvaluationProgressResponse:
    return EvaluationProgressResponse(**progress.snapshot())
