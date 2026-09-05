"""Đánh giá chất lượng dịch máy trên FLEURS — mục 3(b) biên bản GVHD 19/08.

Sáu chiều {vi↔en, vi↔zh, vi↔ja}, mỗi chiều một dòng kết quả. Đầu vào và câu tham chiếu
đều là **văn bản có sẵn** của FLEURS, không đi qua ASR — cố ý như vậy để lỗi của khối MT
không bị lẫn với lỗi của khối ASR.

    uv run python scripts/eval_mt.py --limit 30              # chạy thử, vài phút
    uv run python scripts/eval_mt.py --json bao-cao-mt.json  # bản đầy đủ cho báo cáo

Script đo spBLEU và chrF++. **COMET là một bước riêng**: ``unbabel-comet`` ghim
``numpy<2``/``transformers<5`` nên không cài chung venv với dịch vụ được. Chạy tiếp
``scripts/eval_comet.py`` trên chính file JSON ở trên — nó tự dựng môi trường riêng.
Vì vậy ``--json`` ghi kèm từng câu (nguồn / bản dịch / tham chiếu), tiện cho cả việc
soi lỗi khi viết báo cáo.

Lần chạy đầu tải model NLLB (~2,5 GB). Chạy trên CPU nên bản đầy đủ (347 câu × 6
chiều) mất khá lâu — dùng ``--limit`` để ước lượng trước rồi hẵng chạy hết.

Xem ``scripts/metrics.py`` để biết vì sao dùng spBLEU chứ không phải BLEU mặc định.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import fleurs
import metrics

from llvt_ai_service.adapters.mt.nllb import NllbTranslator
from llvt_ai_service.config.presets import get_preset_config
from llvt_ai_service.config.settings import get_settings
from llvt_ai_service.domain.enums import Language, Preset

# Ba cặp × hai chiều = sáu chiều thầy yêu cầu.
PAIRS: tuple[tuple[Language, Language], ...] = (
    (Language.vi, Language.en),
    (Language.en, Language.vi),
    (Language.vi, Language.zh),
    (Language.zh, Language.vi),
    (Language.vi, Language.ja),
    (Language.ja, Language.vi),
)


@dataclass
class DirectionResult:
    direction: str
    sentences: int
    bleu: float
    chrf: float
    seconds: float
    # Từng câu: nguồn / bản dịch / tham chiếu — đầu vào cho eval_comet.py.
    sentences_detail: list[dict[str, str]]


async def run_direction(
    translator: NllbTranslator,
    source: Language,
    target: Language,
    limit: int | None,
) -> DirectionResult:
    rows = fleurs.parallel(source, target)
    if limit:
        rows = rows[:limit]
    sources = [r[0] for r in rows]
    references = [r[1] for r in rows]

    started = time.perf_counter()
    hypotheses = []
    for index, text in enumerate(sources, start=1):
        result = await translator.translate(text, source, target)
        hypotheses.append(result.translated_text)
        if index % 25 == 0 or index == len(sources):
            print(f"    {source.value}→{target.value}: {index}/{len(sources)}", flush=True)
    seconds = time.perf_counter() - started

    return DirectionResult(
        direction=f"{source.value}→{target.value}",
        sentences=len(rows),
        bleu=round(metrics.bleu(references, hypotheses), 2),
        chrf=round(metrics.chrf(references, hypotheses), 2),
        seconds=round(seconds, 1),
        sentences_detail=[
            {"src": s, "mt": h, "ref": r} for s, h, r in zip(sources, hypotheses, references)
        ],
    )


def print_table(results: list[DirectionResult]) -> None:
    head = f"{'chiều dịch':<12}{'câu':>6}{'spBLEU':>9}{'chrF++':>9}{'thời gian':>11}"
    print("\n" + head)
    print("-" * len(head))
    for r in results:
        print(f"{r.direction:<12}{r.sentences:>6}{r.bleu:>9.2f}{r.chrf:>9.2f}{r.seconds:>10.0f}s")
    print("-" * len(head))
    print(f"{'trung bình':<12}{'':>6}{sum(r.bleu for r in results) / len(results):>9.2f}", end="")
    print(f"{sum(r.chrf for r in results) / len(results):>9.2f}")
    print()


async def main_async(args: argparse.Namespace) -> None:
    cfg = get_preset_config(Preset(args.preset))
    translator = NllbTranslator(cfg.mt_model, models_dir=str(get_settings().models_dir / "nllb"))
    print(f"Nạp MT: {cfg.mt_model} (preset {args.preset})…", flush=True)
    await translator.load()

    results = []
    for source, target in PAIRS:
        results.append(await run_direction(translator, source, target, args.limit))
    await translator.unload()

    print_table(results)
    if args.json:
        payload = {
            "dataset": "google/fleurs",
            "split": "test",
            "preset": args.preset,
            "model": cfg.mt_model,
            "bleu_tokenizer": "flores200 (spBLEU)",
            "limit": args.limit,
            "directions": [asdict(r) for r in results],
        }
        Path(args.json).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"Đã ghi {args.json}")
        print(f"Chấm COMET: uv run --no-project scripts/eval_comet.py {args.json}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Đo BLEU/chrF++/COMET trên FLEURS, 6 chiều")
    parser.add_argument(
        "--limit", type=int, default=None, help="số câu mỗi chiều (bỏ trống = toàn bộ)"
    )
    parser.add_argument(
        "--preset", default=Preset.balanced.value, choices=[p.value for p in Preset]
    )
    parser.add_argument("--json", help="ghi kết quả ra file JSON")
    asyncio.run(main_async(parser.parse_args()))


if __name__ == "__main__":
    main()
