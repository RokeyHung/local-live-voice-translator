#!/usr/bin/env bash
# Gói AI service Python thành một cây thư mục tự chạy, để electron-builder chép
# vào Resources của bản cài.
#
#   tools/bundle_service.sh [--with-mlx] [--with-diarization] [--with-ctranslate2] [--with-vulkan]
#
# Kết quả: dist/service/ — một bản CPython standalone (python-build-standalone,
# do uv quản lý) đã cài sẵn llvt_ai_service và toàn bộ phụ thuộc lõi. Main
# process của Electron chạy nó bằng `<bundle>/bin/python3.12 -m llvt_ai_service`.
#
# Vì sao chép cả bộ thông dịch thay vì PyInstaller: torch, sherpa-onnx,
# pywhispercpp và pyopenjtalk đều mang .dylib/.so riêng trong wheel. Để nguyên
# dạng đã cài thì chúng nạp đúng như lúc chạy dev; freeze lại thì phải khai báo
# tay từng file và ký lại từng dylib. Đổi lại bản cài nặng hơn ~300 MB.
#
# Vì sao KHÔNG dùng venv: pyvenv.cfg trỏ `home` tới bản Python gốc bằng đường
# dẫn tuyệt đối, nên venv chép sang máy khác là hỏng. Bản standalone thì tự tìm
# prefix theo vị trí file thực thi — chép đi đâu cũng chạy (đã kiểm chứng).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/dist/service"
PY_VERSION="3.12"

EXTRAS=()
VULKAN=0
for arg in "$@"; do
  case "$arg" in
    --with-vulkan) VULKAN=1 ;;
    --with-mlx) EXTRAS+=("mlx") ;;
    --with-diarization) EXTRAS+=("diarization") ;;
    --with-ctranslate2) EXTRAS+=("ctranslate2") ;;
    *) echo "Tham số lạ: $arg" >&2; exit 1 ;;
  esac
done

command -v uv >/dev/null || { echo "Cần uv trên PATH (source \"\$HOME/.local/bin/env\")" >&2; exit 1; }

echo "▶ Tìm CPython standalone $PY_VERSION do uv quản lý…"
uv python install "$PY_VERSION" --managed-python >/dev/null 2>&1 || true
SRC_PY="$(uv python find "$PY_VERSION" --managed-python --no-project)"
# uv trỏ vào file thực thi (bin/python3.12 hoặc python.exe); ta cần thư mục gốc.
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) SRC_ROOT="$(dirname "$SRC_PY")" ;;
  *)                    SRC_ROOT="$(dirname "$(dirname "$SRC_PY")")" ;;
esac
# uv trả về đường dẫn qua symlink cpython-3.12-… → cpython-3.12.13-…, mà `cp -R`
# lại đi theo symlink ở mức trên cùng: bản chép sẽ vẫn tự nhận prefix là bản gốc
# trong cache, và uv từ chối cài vào đó. `pwd -P` phân giải về thư mục thật.
SRC_ROOT="$(cd "$SRC_ROOT" && pwd -P)"
echo "  $SRC_ROOT"

echo "▶ Chép bộ thông dịch sang dist/service…"
rm -rf "$OUT"
mkdir -p "$(dirname "$OUT")"
cp -R "$SRC_ROOT" "$OUT"

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) BUNDLE_PY="$OUT/python.exe" ;;
  *)                    BUNDLE_PY="$OUT/bin/python$PY_VERSION" ;;
esac

# uv từ chối cài vào bản Python nó quản lý. Đây là BẢN CHÉP dùng để đóng gói,
# không phải bản gốc trong cache, nên gỡ dấu hiệu đó đi là đúng.
find "$OUT" -name EXTERNALLY-MANAGED -delete

TARGET="$ROOT/apps/ai-service"
if ((${#EXTRAS[@]})); then
  SPEC="$TARGET[$(IFS=,; echo "${EXTRAS[*]}")]"
  echo "▶ Cài service kèm extra: ${EXTRAS[*]}"
else
  SPEC="$TARGET"
  echo "▶ Cài service (chỉ phụ thuộc lõi)…"
fi
uv pip install --system --python "$BUNDLE_PY" "$SPEC"

if ((VULKAN)); then
  # Thay wheel pywhispercpp CPU bằng bản build Vulkan cùng phiên bản (xem
  # tools/build_whisper_vulkan.sh). Wheel được giữ ở dist/wheels để lần đóng gói
  # sau khỏi build lại.
  PWC_VERSION="$("$BUNDLE_PY" -c 'import importlib.metadata as m; print(m.version("pywhispercpp"))')"
  echo "▶ Thay pywhispercpp $PWC_VERSION bằng bản Vulkan…"
  WHEEL="$("$ROOT/tools/build_whisper_vulkan.sh" "$PWC_VERSION" "$ROOT/dist/wheels" | tail -1)"
  uv pip install --system --python "$BUNDLE_PY" --reinstall --no-deps "$WHEEL"
fi

echo "▶ Dọn phần không cần cho lúc chạy…"
# Bytecode sinh lại được, và test/idlelib/tkinter của chính CPython không đường
# nào gọi tới — cộng lại khoảng 40 MB.
find "$OUT" -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true
find "$OUT" -name '*.pyc' -delete 2>/dev/null || true
for junk in test idlelib tkinter turtledemo lib2to3; do
  rm -rf "$OUT/lib/python$PY_VERSION/$junk" "$OUT/Lib/$junk" 2>/dev/null || true
done

# Ghi lại bản này gói từ đâu — khi bản cài chạy sai, đây là thứ đầu tiên cần xem.
cat > "$OUT/BUNDLE-INFO.txt" <<EOF
llvt-ai-service bundle
build-date: $(date -u +%Y-%m-%dT%H:%M:%SZ)
platform:   $(uname -s) $(uname -m)
python:     $("$BUNDLE_PY" -c 'import sys; print(sys.version.split()[0])')
extras:     ${EXTRAS[*]:-(không)}
vulkan:     $( ((VULKAN)) && echo có || echo không)
git:        $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo 'n/a')
EOF

echo "▶ Kiểm tra bundle nạp được các thư viện có native lib…"
# PYTHONUTF8: trên Windows stdout bị pipe là cp1252, không in được dấu ✓.
PYTHONUTF8=1 "$BUNDLE_PY" - <<'PY'
import importlib

for name in ("llvt_ai_service", "torch", "transformers", "sherpa_onnx", "pywhispercpp", "silero_vad"):
    importlib.import_module(name)
print("  ✓ import OK")
PY

echo "✓ Xong: $OUT ($(du -sh "$OUT" | cut -f1))"
