"""Đánh giá chất lượng nhận dạng giọng nói trên FLEURS — mục 3(a) biên bản GVHD 19/08.

Chạy Whisper trên audio của FLEURS, so với ``transcription`` có sẵn của FLEURS, **từng
ngôn ngữ một** (vi, en, zh, ja).

    uv run python scripts/eval_asr.py --limit 20            # chạy thử, tải ít
    uv run python scripts/eval_asr.py --json bao-cao-asr.json

    # đổi runtime và/hoặc model (bảng so sánh backend ở docs/04)
    uv run python scripts/eval_asr.py --adapter mlx_whisper \
        --model mlx-community/whisper-large-v3-asr-fp16 --json asr-mlx.json

Adapter được dựng qua ``ASR_REGISTRY`` chứ không import thẳng một lớp cụ thể, nên thêm
backend mới vào registry là đo được ngay, không phải sửa script này. ``--model`` phải là
tên đúng theo runtime đang chọn: GGML là tên file trong repo whisper.cpp, MLX và
CTranslate2 là repo id đã chuyển đổi sẵn — chúng KHÔNG thay nhau được (xem docs/04).

Hai lưu ý về phương pháp:

* Chỉ số là **WER cho vi/en** và **CER cho zh/ja** — xem ``scripts/metrics.py``.
* Bộ lọc câu ma (``adapters/asr/hallucination.py``) mặc định **TẮT** ở đây: mục tiêu là
  đo chất lượng của *mô hình* Whisper, còn bộ lọc là một lớp sản phẩm nằm sau nó. Bật
  bằng ``--with-filter`` nếu muốn con số của cả hệ thống như người dùng thấy.

Lần chạy đầu không có ``--limit`` sẽ tải trọn split ``test`` của ngôn ngữ đó
(380–660 MB mỗi ngôn ngữ) vào cache của ``datasets``.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
from dataclasses import asdict, dataclass, replace
from pathlib import Path

import fleurs
import metrics

from llvt_ai_service.application.model_manager import ASR_REGISTRY, asr_adapter_name, asr_model
from llvt_ai_service.config.presets import get_preset_config
from llvt_ai_service.config.settings import get_settings
from llvt_ai_service.domain.enums import Language, Preset
from llvt_ai_service.ports.asr import SpeechToTextProvider

LANGUAGES: tuple[Language, ...] = (Language.vi, Language.en, Language.zh, Language.ja)


@dataclass
class LanguageResult:
    language: str
    metric: str  # "WER" hoặc "CER"
    score: float
    samples: int
    audio_seconds: float
    asr_seconds: float
    rtf: float
    empty: int  # số câu ASR trả về rỗng (bị lọc, hoặc model không ra chữ nào)


async def run_language(
    asr: SpeechToTextProvider, language: Language, limit: int | None
) -> LanguageResult:
    references: list[str] = []
    hypotheses: list[str] = []
    audio_seconds = 0.0
    asr_seconds = 0.0

    for index, item in enumerate(fleurs.load_audio(language, limit=limit), start=1):
        started = time.perf_counter()
        transcript = await asr.transcribe(item.pcm, language)
        asr_seconds += time.perf_counter() - started
        audio_seconds += item.duration_s
        references.append(item.normalized)
        hypotheses.append(transcript.text)
        if index % 25 == 0:
            print(f"    {language.value}: {index} câu…", flush=True)

    print(f"    {language.value}: xong {len(references)} câu", flush=True)
    return LanguageResult(
        language=language.value,
        metric=metrics.metric_name(language),
        score=round(metrics.error_rate(references, hypotheses, language), 4),
        samples=len(references),
        audio_seconds=round(audio_seconds, 1),
        asr_seconds=round(asr_seconds, 1),
        # RTF của riêng khâu ASR; RTF toàn hệ thống đo ở scripts/eval_latency.py.
        rtf=round(asr_seconds / audio_seconds, 3) if audio_seconds else 0.0,
        empty=sum(1 for h in hypotheses if not h.strip()),
    )


def print_table(results: list[LanguageResult]) -> None:
    head = f"{'ngôn ngữ':<10}{'chỉ số':>8}{'giá trị':>10}{'câu':>6}"
    head += f"{'audio':>10}{'ASR':>10}{'RTF':>8}{'rỗng':>7}"
    print("\n" + head)
    print("-" * len(head))
    for r in results:
        print(
            f"{r.language:<10}{r.metric:>8}{r.score:>9.1%}{r.samples:>6}"
            f"{r.audio_seconds:>9.0f}s{r.asr_seconds:>9.0f}s{r.rtf:>8.2f}{r.empty:>7}"
        )
    print()


async def main_async(args: argparse.Namespace) -> None:
    metrics.require("jiwer", "datasets", "soundfile")

    # Đo mô hình, không đo bộ lọc — trừ khi người chạy muốn con số cả hệ thống. Tắt ở
    # tầng settings chứ không truyền tham số, vì adapter được dựng qua ASR_REGISTRY và
    # mọi factory trong đó đều tự đọc `asr_min_confidence`.
    if not args.with_filter:
        os.environ["LLVT_ASR_MIN_CONFIDENCE"] = "0"
        get_settings.cache_clear()

    cfg = get_preset_config(Preset(args.preset))
    adapter = args.adapter or asr_adapter_name(cfg)
    model = args.model or asr_model(cfg, adapter)
    # Ghi đè ngược vào cfg: factory trong registry gọi lại `asr_model(cfg, adapter)`,
    # nên đây là cách đưa lựa chọn của người chạy tới đúng adapter mà không phải đụng
    # vào registry hay preset.
    cfg = replace(cfg, asr_adapter=adapter, asr_model=model)
    asr = ASR_REGISTRY[adapter](cfg)
    print(f"Nạp ASR: {model} qua {adapter} (preset {args.preset})…", flush=True)
    await asr.load()
    print(f"  backend: {asr.runtime_info()}", flush=True)

    languages = [Language(code) for code in args.language] if args.language else LANGUAGES
    results = [await run_language(asr, language, args.limit) for language in languages]
    await asr.unload()

    print_table(results)
    if args.json:
        payload = {
            "dataset": "google/fleurs",
            "split": "test",
            "preset": args.preset,
            "adapter": adapter,
            "model": model,
            "runtime": asr.runtime_info(),
            "hallucination_filter": bool(args.with_filter),
            "limit": args.limit,
            "languages": [asdict(r) for r in results],
        }
        Path(args.json).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"Đã ghi {args.json}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Đo WER/CER của ASR trên FLEURS")
    parser.add_argument(
        "--limit", type=int, default=None, help="số câu mỗi ngôn ngữ (bỏ trống = toàn bộ)"
    )
    parser.add_argument(
        "--language",
        action="append",
        choices=[lang.value for lang in LANGUAGES],
        help="chỉ đo ngôn ngữ này (lặp lại được); mặc định đo cả bốn",
    )
    parser.add_argument(
        "--preset", default=Preset.balanced.value, choices=[p.value for p in Preset]
    )
    parser.add_argument(
        "--adapter",
        choices=sorted(ASR_REGISTRY),
        help="runtime ASR (mặc định: LLVT_ASR_ADAPTER nếu có, không thì của preset)",
    )
    parser.add_argument(
        "--model",
        help="tên model ĐÚNG THEO RUNTIME đó — ba runtime không dùng chung tên model "
        "(mặc định: model của preset cho runtime đang chọn)",
    )
    parser.add_argument(
        "--with-filter", action="store_true", help="bật bộ lọc câu ma (đo cả hệ thống)"
    )
    parser.add_argument("--json", help="ghi kết quả ra file JSON")
    asyncio.run(main_async(parser.parse_args()))


if __name__ == "__main__":
    main()
