# Nguồn hình của khóa luận

Mỗi tệp `.mmd` là nguồn Mermaid của một sơ đồ trong `docs/gvhd/khoa-luan.md`; tên tệp trùng tên
ảnh PNG ở thư mục cha. Hình `h4-*` là biểu đồ số đo, sinh từ `docs/results/` bằng `charts.py`.
Hình `h3-12` … `h3-17` là ảnh chụp màn hình ứng dụng, chụp tay.

Vẽ lại tất cả:

```bash
make figures-khoa-luan
```
