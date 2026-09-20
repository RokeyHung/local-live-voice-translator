#!/usr/bin/env bash
#
# Tải trước dữ liệu FLEURS cho bộ đánh giá (docs/05) — chạy được nhiều lần, file nào
# đã có thì bỏ qua.
#
#   scripts/fetch_fleurs.sh              # cả bốn ngôn ngữ, split test (~2,3 GB)
#   scripts/fetch_fleurs.sh vi           # chỉ tiếng Việt
#   FLEURS_CACHE=/duong/dan scripts/fetch_fleurs.sh
#
# Vì sao cần script này thay vì để `make eval-asr` tự tải: lượt tải là hơn 2 GB, đứt
# mạng giữa chừng thì mất luôn cả lượt chạy đánh giá. Tải riêng thì chạy lại là tiếp
# tục chỗ dở.
#
# Hai nguồn khác nhau, KHÔNG gộp được:
#   * văn bản  — nhánh main,                `data/<config>/test.tsv`   (~600 KB)
#   * audio    — nhánh refs/convert/parquet, `<config>/test/*.parquet` (380–660 MB)
# `datasets.load_dataset()` đọc bản parquet tự chuyển đổi chứ KHÔNG đọc
# `data/<config>/audio/test.tar.gz` trên main — tải nhầm nhánh là tải thừa vài GB mà
# script đánh giá vẫn đi tải lại.
#
# Dùng `snapshot_download` chứ không dùng `hf download --include`: CLI nhận
# `repo_id [filenames...]` là tham số vị trí, nên khi truyền nhiều mẫu sau `--include`
# thì một phần rơi vào `filenames` và toàn bộ `--include` bị bỏ qua (chỉ cảnh báo, vẫn
# thoát mã 0) — đúng cái bẫy đã làm thiếu mất tiếng Việt một lần.

set -euo pipefail

# Chạy thẳng script này trên Windows (Git Bash) thì stdout là cp1252 và dòng log
# tiếng Việt làm Python chết bằng UnicodeEncodeError. Makefile cũng export biến
# này, đặt lại ở đây để gọi trực tiếp cũng chạy được.
export PYTHONUTF8=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$(dirname "$AI_DIR")")"

# Nơi chứa cache của Hugging Face. Mặc định nằm trong repo (đã có trong .gitignore);
# đổi bằng biến môi trường nếu muốn để chỗ khác, ví dụ cạnh thư mục models.
FLEURS_CACHE="${FLEURS_CACHE:-$REPO_ROOT/fleurs-cache}"

if ! command -v uv >/dev/null 2>&1; then
	echo "Không thấy uv trên PATH. Thử: source \"\$HOME/.local/bin/env\"" >&2
	exit 1
fi

mkdir -p "$FLEURS_CACHE"
echo "Cache: $FLEURS_CACHE"

cd "$AI_DIR"
HF_HUB_CACHE="$FLEURS_CACHE" uv run python - "$@" <<'PY'
import sys
from pathlib import Path

sys.path.insert(0, "scripts")

from huggingface_hub import snapshot_download

from fleurs import LANG_CONFIG, REPO
from llvt_ai_service.domain.enums import Language

known = {lang.value: config for lang, config in LANG_CONFIG.items()}
codes = sys.argv[1:] or list(known)

for code in codes:
    if code not in known:
        raise SystemExit(f"Ngôn ngữ '{code}' không nằm trong FLEURS của đề tài: {', '.join(known)}")

for code in codes:
    config = known[code]
    lang = Language(code)
    print(f"\n=== {lang.value} ({config}) ===", flush=True)

    print("• văn bản (test.tsv)", flush=True)
    snapshot_download(REPO, repo_type="dataset", allow_patterns=[f"data/{config}/test.tsv"])

    print("• audio (parquet, có thể vài trăm MB)", flush=True)
    path = snapshot_download(
        REPO,
        repo_type="dataset",
        revision="refs/convert/parquet",
        allow_patterns=[f"{config}/test/*.parquet"],
    )
    shards = sorted(Path(path, config, "test").glob("*.parquet"))
    if not shards:
        raise SystemExit(f"Tải xong nhưng không thấy parquet nào cho {config} — dừng ở đây.")
    total = sum(shard.stat().st_size for shard in shards)
    print(f"  {len(shards)} file, {total / 2**20:.0f} MiB", flush=True)
PY

echo
du -sh "$FLEURS_CACHE"
cat <<EOF

Xong. Chạy đánh giá với cùng cache đó:

  make eval-mt FLEURS_CACHE=$FLEURS_CACHE
  make eval-asr FLEURS_CACHE=$FLEURS_CACHE

(mặc định của Makefile đã là thư mục này, chỉ cần \`make eval-mt\`)
EOF
