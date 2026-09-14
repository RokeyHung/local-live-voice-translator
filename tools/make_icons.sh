#!/usr/bin/env bash
# Sinh bộ icon của app từ một file PNG vuông duy nhất.
#
#   tools/make_icons.sh [nguồn.png] [--margin PHẦN_TRĂM]
#
# Nguồn mặc định là apps/desktop/build/icon-source.png. Ba file sinh ra là thứ
# electron-builder đi tìm theo tên: icon.icns (macOS), icon.ico (Windows),
# icon.png (Linux + cửa sổ trên Linux).
#
# Bước đầu luôn là CẮT SÁT hình: ảnh vẽ ra thường có viền trong suốt thừa, mà độ
# dày bốn phía không bằng nhau, nên icon bị lệch và nhỏ hơn icon của app khác.
# Script tự dò mép hình đặc rồi cắt về đúng một hình vuông ôm sát nó.
#
# --margin thêm lại lề rỗng theo % cạnh (mặc định 0 = sát mép). macOS quy ước
# icon chiếm khoảng 80% khung, tức --margin 10; đặt lại nếu thấy icon trên Dock
# to hơn hẳn hàng xóm.
#
# Chỉ chạy được trên macOS — iconutil là công cụ của hệ điều hành; máy Windows
# dùng luôn icon.ico đã commit.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT/apps/desktop/build"
SRC="$BUILD_DIR/icon-source.png"
MARGIN=0

while (($#)); do
  case "$1" in
    --margin) MARGIN="$2"; shift 2 ;;
    *) SRC="$1"; shift ;;
  esac
done

[[ -f "$SRC" ]] || { echo "Không thấy file nguồn: $SRC" >&2; exit 1; }
command -v iconutil >/dev/null || { echo "Cần iconutil (chỉ có trên macOS)" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ICONSET="$TMP/icon.iconset"
mkdir -p "$ICONSET"

# Toàn bộ phần cắt + thu nhỏ làm bằng Pillow: nó cho lọc LANCZOS (nét hơn sips ở
# các cỡ nhỏ như 16px) và là thứ duy nhất ghi được .ico. iconutil chỉ còn việc
# đóng thư mục .iconset thành .icns.
uv run --no-project --quiet --with pillow python - "$SRC" "$TMP" "$BUILD_DIR" "$ROOT" "$MARGIN" <<'PY'
import sys

from PIL import Image

source, tmp, build_dir, root, margin_pct = sys.argv[1:6]
margin_pct = float(margin_pct)

im = Image.open(source).convert("RGBA")
alpha = im.split()[-1]

# Ngưỡng 40 chứ không phải 0: ảnh sinh ra hay dính vài điểm gần trong suốt ở góc
# (bóng đổ, nhiễu nén). Lấy bbox theo alpha > 0 là ôm luôn đám rác đó và cắt hụt.
box = alpha.point(lambda a: 255 if a > 40 else 0).getbbox()
if box is None:
    raise SystemExit("Ảnh nguồn trong suốt hoàn toàn")
im = im.crop(box)

# Hình sau khi cắt hiếm khi vuông. Đệm về hình vuông theo cạnh dài (đệm trong
# suốt, KHÔNG kéo giãn) để không méo, rồi mới thêm lề nếu có yêu cầu.
side = max(im.size)
side = round(side / (1 - 2 * margin_pct / 100)) if margin_pct else side
square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
square.paste(im, ((side - im.width) // 2, (side - im.height) // 2))

print(f"   cắt {Image.open(source).size} → nội dung {box[2]-box[0]}x{box[3]-box[1]} → khung {side}x{side}")


def resized(n: int) -> Image.Image:
    return square.resize((n, n), Image.LANCZOS)


# macOS đọc tên file trong .iconset theo đúng quy ước này, sai tên là iconutil bỏ qua.
for size in (16, 32, 128, 256, 512):
    resized(size).save(f"{tmp}/icon.iconset/icon_{size}x{size}.png")
    resized(size * 2).save(f"{tmp}/icon.iconset/icon_{size}x{size}@2x.png")

resized(1024).save(f"{build_dir}/icon.png")
# Cửa sổ trên Linux nạp icon từ resources/ chứ không phải build/ (main/index.ts).
resized(512).save(f"{root}/apps/desktop/resources/icon.png")
square.save(f"{build_dir}/icon.ico", format="ICO", sizes=[(n, n) for n in (16, 24, 32, 48, 64, 128, 256)])
PY

iconutil --convert icns "$ICONSET" --output "$BUILD_DIR/icon.icns"

echo "✓ Đã sinh icon từ $(basename "$SRC")$( ((${MARGIN%.*} > 0)) && echo " (lề ${MARGIN}%)"):"
for f in "$BUILD_DIR/icon.icns" "$BUILD_DIR/icon.ico" "$BUILD_DIR/icon.png" "$ROOT/apps/desktop/resources/icon.png"; do
  echo "   $(du -h "$f" | cut -f1)  ${f#"$ROOT"/}"
done
