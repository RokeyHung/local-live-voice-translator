# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["unbabel-comet>=2.2.7"]
# ///
"""Chấm COMET cho kết quả dịch của ``eval_mt.py`` — mục 3(b) biên bản GVHD 19/08.

    uv run --no-project scripts/eval_comet.py bao-cao-mt.json

**Vì sao là một script riêng chứ không nằm trong eval_mt.py.** ``unbabel-comet`` ghim
``numpy<2.0`` và ``transformers<5.0``, trong khi dịch vụ cần ``numpy>=2.4`` và
``transformers>=5.14`` cho NLLB. Hai bộ ràng buộc này không thể cùng tồn tại trong một
môi trường, nên COMET được tách hẳn ra: khối metadata PEP 723 ở đầu file khiến
``uv run --no-project`` tự dựng một môi trường riêng chỉ cho script này. Không đụng gì
tới ``.venv`` của dự án.

Script đọc file JSON do ``eval_mt.py`` xuất ra (đã có sẵn từng cặp src/mt/ref cho mỗi
chiều), chấm điểm rồi ghi ngược lại vào chính file đó dưới khoá ``comet``.

Lần chạy đầu tải ``Unbabel/wmt22-comet-da`` (~2,3 GB). Chấm trên CPU khá chậm — vài
phút cho mỗi trăm câu.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

MODEL = "Unbabel/wmt22-comet-da"


def main() -> None:
    parser = argparse.ArgumentParser(description="Chấm COMET cho báo cáo MT của eval_mt.py")
    parser.add_argument("report", type=Path, help="file JSON do eval_mt.py --json sinh ra")
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument(
        "--gpus", type=int, default=0, help="0 = chấm trên CPU (mặc định), 1 = dùng GPU"
    )
    args = parser.parse_args()

    payload = json.loads(args.report.read_text(encoding="utf-8"))
    directions = payload.get("directions")
    if not directions:
        raise SystemExit(f"{args.report} không có khoá 'directions' — có đúng là báo cáo MT không?")
    if not all(d.get("sentences_detail") for d in directions):
        raise SystemExit(
            "Báo cáo thiếu 'sentences_detail'. Chạy lại eval_mt.py bản mới để xuất từng câu."
        )

    from comet import download_model, load_from_checkpoint

    print(f"Nạp {MODEL} (lần đầu sẽ tải ~2,3 GB)…", flush=True)
    model = load_from_checkpoint(download_model(MODEL))

    for entry in directions:
        rows = entry["sentences_detail"]
        print(f"  {entry['direction']}: {len(rows)} câu…", flush=True)
        output = model.predict(rows, batch_size=args.batch_size, gpus=args.gpus, progress_bar=False)
        entry["comet"] = round(float(output.system_score), 4)

    payload["comet_model"] = MODEL
    args.report.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{'chiều dịch':<12}{'câu':>6}{'spBLEU':>9}{'chrF++':>9}{'COMET':>9}")
    print("-" * 45)
    for entry in directions:
        print(
            f"{entry['direction']:<12}{entry['sentences']:>6}"
            f"{entry['bleu']:>9.2f}{entry['chrf']:>9.2f}{entry['comet']:>9.4f}"
        )
    print(f"\nĐã ghi điểm COMET vào {args.report}", file=sys.stderr)


if __name__ == "__main__":
    main()
