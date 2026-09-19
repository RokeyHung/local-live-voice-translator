#!/usr/bin/env bash
# Build lại pywhispercpp với backend Vulkan của whisper.cpp (chỉ Windows x64).
#
#   tools/build_whisper_vulkan.sh <phiên-bản> <thư-mục-ra>
#
# In ra đường dẫn wheel ở dòng cuối. Wheel đã build rồi (ở <thư-mục-ra>/vulkan)
# thì dùng lại, không build lần nữa (mất ~6 phút).
#
# Vì sao Vulkan: wheel pywhispercpp trên PyPI chỉ có CPU, và trên Windows không
# có Metal như macOS — large-v3-turbo mất ~17 s cho 3 s audio trên laptop CPU,
# ~0,13 s trên RTX 4060 qua Vulkan. Bản CUDA dựng sẵn của whisper.cpp nặng
# 273–675 MB vì phải kèm cuBLAS, còn Vulkan có sẵn trong driver của mọi card
# NVIDIA, AMD, Intel — wheel chỉ nặng 19 MB (bản CPU 1,4 MB). Cùng file GGML,
# cùng adapter, không đổi dòng code nào ở pipeline. Ý tưởng lấy từ cách
# TranscriptionSuite chạy whisper.cpp Vulkan trên Windows.
#
# Cần trên máy BUILD (máy người dùng thì không): Visual Studio Build Tools có
# workload C++, Vulkan SDK (glslc để biên dịch shader). CMake/Ninja do pip tự
# kéo về làm build dependency.
set -euo pipefail

VERSION="${1:?Thiếu phiên bản pywhispercpp}"
OUT_DIR="${2:?Thiếu thư mục ra}"

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) ;;
  *) echo "Chỉ build Vulkan trên Windows (macOS đã có Metal)." >&2; exit 1 ;;
esac

# Thư mục riêng cho bản Vulkan: wheel ra trùng tên với wheel CPU trên PyPI
# (setup.py bỏ qua hậu tố phiên bản), nên phân biệt bằng chỗ để.
OUT_DIR="$OUT_DIR/vulkan"
mkdir -p "$OUT_DIR"
existing="$(find "$OUT_DIR" -maxdepth 1 -name "pywhispercpp-${VERSION}-*.whl" | head -1)"
if [[ -n "$existing" ]]; then
  echo "  (dùng lại wheel đã build)" >&2
  echo "$existing"
  exit 0
fi

# Installer của Vulkan SDK ghi VULKAN_SDK vào biến môi trường hệ thống, nhưng
# shell mở từ trước khi cài không thấy nó.
if [[ -z "${VULKAN_SDK:-}" ]]; then
  VULKAN_SDK="$(find /c/VulkanSDK -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sort -V | tail -1)"
  [[ -n "$VULKAN_SDK" ]] || { echo "Không thấy Vulkan SDK (winget install KhronosGroup.VulkanSDK)" >&2; exit 1; }
  VULKAN_SDK="$(cygpath -w "$VULKAN_SDK")"
fi
export VULKAN_SDK

# Thư mục build phải NGẮN, ở gốc ổ đĩa. Bước dựng vulkan-shaders-gen là một
# ExternalProject lồng rất sâu (…/vulkan-shaders-gen-prefix/src/vulkan-shaders-gen-build/
# CMakeFiles/<ver>/CompilerIdC/Debug/CompilerIdC.tlog/…), và MSBuild vẫn giới hạn 260
# ký tự: build trong %TEMP% là vượt, CMake chỉ báo "No CMAKE_C_COMPILER could be
# found" — lỗi thật (FTK1011) nằm trong CMakeConfigureLog.yaml.
# Dạng /c/… chứ không phải C:/… — tar đọc "C:" là tên máy từ xa.
WORK="$(cygpath -u "${SYSTEMDRIVE:-C:}\\")llvtvk"
rm -rf "$WORK"
mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT

echo "▶ Tải mã nguồn pywhispercpp $VERSION…" >&2
SDIST_URL="$(curl -fsSL "https://pypi.org/pypi/pywhispercpp/$VERSION/json" \
  | python -c "import json,sys; print(next(f['url'] for f in json.load(sys.stdin)['urls'] if f['packagetype']=='sdist'))")"
curl -fsSL "$SDIST_URL" -o "$WORK/src.tar.gz"
tar xzf "$WORK/src.tar.gz" -C "$WORK"
mv "$WORK/pywhispercpp-$VERSION" "$WORK/s"
SRC="$WORK/s"

echo "▶ Build với GGML_VULKAN=1 (Vulkan SDK: $VULKAN_SDK)…" >&2
# setup.py chuyển MỌI biến môi trường thành -D cho CMake, nên chỉ cần export.
#
# repairwheel sẽ gom cả vulkan-1.dll (bộ nạp Vulkan của SDK) vào wheel. Cố tình
# giữ: bộ nạp vẫn tìm driver của máy qua registry như bản hệ thống, còn trên máy
# KHÔNG có driver Vulkan (máy ảo, máy cũ) thì thiếu file này là ggml-vulkan.dll
# không nạp được và cả whisper.cpp chết lúc import — có nó thì ggml thấy 0 thiết
# bị và tự lùi về CPU.
(
  cd "$SRC"
  GGML_VULKAN=1 uv build --wheel --python 3.12 --out-dir "$WORK/wheel" . >&2
)

wheel="$(find "$WORK/wheel" -name '*.whl' | head -1)"
[[ -n "$wheel" ]] || { echo "Build không ra wheel." >&2; exit 1; }
cp "$wheel" "$OUT_DIR/"
echo "$OUT_DIR/$(basename "$wheel")"
