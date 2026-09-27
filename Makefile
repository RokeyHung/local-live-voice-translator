# Local Live Voice Translator — dev shortcuts
# Yêu cầu: `uv` và `npm` có trên PATH.
# Nếu uv chưa có trên PATH: source "$HOME/.local/bin/env" (hoặc mở lại terminal).

AI_DIR      := apps/ai-service
DESKTOP_DIR := apps/desktop
UV          ?= uv
# Windows: stdout bị pipe (make, tee, CI) mặc định là cp1252, nên mọi dòng log
# tiếng Việt của script Python làm cả lệnh chết bằng UnicodeEncodeError. Cùng họ
# lỗi với log của service khi bị spawn — xem tools/… và docs/04 mục 7.
export PYTHONUTF8 := 1
NPM         ?= npm
NPX         ?= npx
# Prettier dùng chung cho Markdown (đến từ node_modules của desktop)
PRETTIER    := $(DESKTOP_DIR)/node_modules/.bin/prettier
# Thời lượng của `make soak` (đổi bằng: make soak MINUTES=5)
MINUTES     ?= 60
# Tiền tố tên file của `make segment` (make segment MEDIA=x.mov PREFIX=vlog)
PREFIX      ?= rec
# Nơi để dữ liệu FLEURS tải về (vài GB). Trỏ HF_HUB_CACHE vào đây cho các lệnh eval-*
# đọc audio để sẵn thay vì tải lại; model vẫn nằm ở models_dir vì adapter truyền
# cache_dir riêng, không đi qua biến này.
FLEURS_CACHE ?= $(CURDIR)/fleurs-cache
# HF_DATASETS_CACHE là chỗ `datasets` giải nén parquet thành arrow — mặc định nó nằm ở
# ~/.cache, tức là dữ liệu đánh giá bị chẻ làm hai nơi. Gom về cùng thư mục.
EVAL_ENV     := HF_HUB_CACHE=$(FLEURS_CACHE) HF_DATASETS_CACHE=$(FLEURS_CACHE)/datasets
# Tên file kết quả của `make eval-asr`. Đổi khi đo backend thứ hai để không ghi đè bảng
# cũ: make eval-asr ADAPTER=mlx_whisper MODEL=... JSON=eval-asr-mlx.json
JSON         ?= eval-asr.json
# Nơi để các bản Word xuất từ Markdown (make docx). Không commit: dựng lại được từ docs/.
WORD_DIR     ?= docs/word
# mlx-audio chỉ có bản cho macOS trên chip Apple; thêm extra này ở máy khác thì uv giải
# phụ thuộc không ra và cả lệnh setup hỏng theo.
MLX_EXTRA    := $(if $(filter Darwin-arm64,$(shell uname -s)-$(shell uname -m)),--extra mlx)
# Bản cài đầy đủ: phụ thuộc lõi + nhóm eval + mọi backend tuỳ chọn chạy được trên máy này.
FULL_DEPS    := --group eval --extra diarization --extra ctranslate2 $(MLX_EXTRA)

.DEFAULT_GOAL := help

.PHONY: help setup setup-service setup-min setup-desktop dev service desktop preview \
        build typecheck lint format format-docs health docs docx test test-service test-desktop e2e \
        icons bundle-service dist \
        bench accuracy soak segment \
        endpointing docx-khoa-luan figures-khoa-luan figures-app setup-eval setup-mlx setup-diarization setup-ctranslate2 setup-vulkan \
        fetch-fleurs eval-asr eval-mt eval-comet eval-latency eval-latency-all clean

help: ## Hiện danh sách lệnh
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

setup: setup-service setup-desktop ## Cài ĐẦY ĐỦ cả hai app: lõi + bộ đánh giá + backend tuỳ chọn

setup-service: ## Cài phụ thuộc Python đầy đủ (lõi + eval + diarization/ctranslate2/mlx)
	cd $(AI_DIR) && $(UV) sync $(FULL_DEPS)

setup-min: ## Chỉ phụ thuộc lõi để chạy app (nhẹ nhất, không có bộ đánh giá)
	cd $(AI_DIR) && $(UV) sync

# LƯU Ý: `uv sync` đồng bộ môi trường về ĐÚNG những gì được nêu — nhóm/extra không nêu
# sẽ bị GỠ. Nên `make setup-mlx` sau `make setup-eval` là mất sacrebleu, và lượt chạy
# `eval-mt` chết ở bước chấm điểm sau khi đã dịch xong một chiều. Bốn lệnh dưới đây chỉ
# dùng khi muốn đúng một thứ; muốn có tất cả thì dùng `make setup`. Ba lệnh `eval-*` tự
# thêm `--group eval` khi chạy nên không còn phụ thuộc vào việc nhớ cài trước.

setup-eval: ## Chỉ cài phụ thuộc bộ đánh giá FLEURS (datasets, sacrebleu, jiwer)
	cd $(AI_DIR) && $(UV) sync --group eval

setup-mlx: ## Chỉ cài backend ASR chạy trên MLX (mlx-audio) — macOS + Apple Silicon
	cd $(AI_DIR) && $(UV) sync --extra mlx

setup-diarization: ## Chỉ cài khâu tách người nói (pyannote.audio) cho màn Nhập tệp
	cd $(AI_DIR) && $(UV) sync --extra diarization

setup-ctranslate2: ## Chỉ cài backend ASR faster-whisper (CPU int8 / NVIDIA fp16)
	cd $(AI_DIR) && $(UV) sync --extra ctranslate2

setup-vulkan: ## Windows: đổi pywhispercpp của venv dev sang bản chạy GPU qua Vulkan
	@# Bộ cài đã mang wheel Vulkan (tools/bundle_service.sh --with-vulkan), nhưng venv
	@# dev thì vẫn là wheel CPU trên PyPI — nên `make dev` và cả `make eval-asr` chạy
	@# whisper.cpp trên CPU (~17 s cho 3 s audio) trong khi bản cài chạy ~0,13 s. Dùng
	@# lại wheel đã build ở dist/wheels/vulkan nếu có, không thì build (cần VS Build
	@# Tools + Vulkan SDK, ~6 phút).
	@# LƯU Ý: `uv sync` sau lệnh này sẽ trả lại wheel CPU vì lock ghim bản PyPI. Chạy
	@# các lệnh đo bằng `UV_NO_SYNC=1 make eval-asr` để giữ nguyên bản Vulkan.
	@WHEEL=$$(ls -t dist/wheels/vulkan/pywhispercpp-*-win_amd64.whl 2>/dev/null | head -1); 	if [ -z "$$WHEEL" ]; then 		PWC=$$(cd $(AI_DIR) && $(UV) run --no-sync python -c "import importlib.metadata as m;print(m.version('pywhispercpp'))"); 		WHEEL=$$(tools/build_whisper_vulkan.sh $$PWC $(CURDIR)/dist/wheels | tail -1); 	fi; 	echo "▶ Cài $$WHEEL"; 	cd $(AI_DIR) && $(UV) pip install --reinstall --no-deps "$(CURDIR)/$$WHEEL"

setup-desktop: ## Cài phụ thuộc desktop (npm install)
	cd $(DESKTOP_DIR) && $(NPM) install

dev: ## Chạy đồng thời AI service + desktop (Ctrl+C dừng cả hai)
	@echo "▶ AI service + desktop… (Ctrl+C to stop)"
	@cd $(AI_DIR) && $(UV) run llvt-ai-service & \
	SVC=$$!; \
	trap 'kill $$SVC 2>/dev/null' EXIT INT TERM; \
	sleep 1; \
	cd $(DESKTOP_DIR) && $(NPM) run dev

service: ## Chỉ chạy Local AI service (http://127.0.0.1:8756)
	cd $(AI_DIR) && $(UV) run llvt-ai-service

desktop: ## Chỉ chạy desktop client (electron-vite dev)
	cd $(DESKTOP_DIR) && $(NPM) run dev

preview: build ## Chạy AI service + desktop từ bản build (không HMR, Ctrl+C dừng cả hai)
	@echo "▶ AI service + desktop (bản build)… (Ctrl+C to stop)"
	@cd $(AI_DIR) && $(UV) run llvt-ai-service & \
	SVC=$$!; \
	trap 'kill $$SVC 2>/dev/null' EXIT INT TERM; \
	sleep 1; \
	cd $(DESKTOP_DIR) && $(NPM) start

build: ## Build desktop (typecheck + electron-vite build)
	cd $(DESKTOP_DIR) && $(NPM) run build

typecheck: ## Typecheck desktop
	cd $(DESKTOP_DIR) && $(NPM) run typecheck

icons: ## Sinh lại icon app từ apps/desktop/build/icon-source.png (chỉ macOS)
	tools/make_icons.sh

# Bản cài macOS mang theo MLX (+~430 MB): đó là backend đã dùng để đo bảng WER trong
# báo cáo (docs/05 mục 8), nên bản giao nộp phải chạy lại được chính con số đó. Máy
# khác không có mlx-audio nên biến này rỗng, và giao diện tự ẩn runtime đó đi.
# Bản Windows thay whisper.cpp CPU bằng bản Vulkan (tools/build_whisper_vulkan.sh):
# chạy GPU trên mọi card NVIDIA/AMD/Intel mà không phải kèm thư viện CUDA.
BUNDLE_EXTRAS ?= $(if $(filter Darwin-arm64,$(shell uname -s)-$(shell uname -m)),--with-mlx)$(if $(filter MINGW% MSYS%,$(shell uname -s)),--with-vulkan)

bundle-service: ## Gói AI service Python thành cây tự chạy ở dist/service (BUNDLE_EXTRAS=...)
	tools/bundle_service.sh $(BUNDLE_EXTRAS)

dist: bundle-service build ## Bộ cài hoàn chỉnh → dist/installer (macOS: .dmg, Windows: .exe)
	@echo "▶ Đóng gói… (bước này chép ~1,5 GB, mất vài phút)"
	cd $(DESKTOP_DIR) && $(NPX) electron-builder --$(if $(filter Darwin,$(shell uname -s)),mac,win)
	@echo "✓ Bộ cài ở dist/installer:"
	@find dist/installer -maxdepth 1 \( -name '*.dmg' -o -name '*.exe' \) -exec du -h {} + 2>/dev/null \
		| while read -r size path; do echo "   $$size  $$(basename "$$path")"; done

lint: ## Lint desktop (eslint) + service (ruff)
	cd $(DESKTOP_DIR) && $(NPM) run lint
	cd $(AI_DIR) && $(UV) run ruff check .

format: format-docs ## Sort imports + format cả hai app và tài liệu Markdown
	cd $(DESKTOP_DIR) && $(NPM) run format
	cd $(AI_DIR) && $(UV) run ruff check --select I --fix . && $(UV) run ruff format .

format-docs: ## Format Markdown ở docs/, ARCHITECTURE.md và thư mục gốc (prettier, cấu hình .prettierrc.yaml)
	@test -x $(PRETTIER) || { echo "Chưa có prettier — chạy 'make setup-desktop' trước."; exit 1; }
	$(PRETTIER) --write "docs/**/*.md" "*.md" "apps/*/ARCHITECTURE.md"

docx: ## Xuất báo cáo đánh giá (gvhd/bao-cao-danh-gia.md) ra Word kèm mục lục
	@$(UV) run --no-project tools/md_to_docx.py docs/gvhd/bao-cao-danh-gia.md \
		--out $(WORD_DIR)/bao-cao-danh-gia.docx --toc

# Tên tệp nộp theo thông báo của CITD: MSSV_HoTen_DATN, không dấu và không khoảng trắng.
# Form của ngành nhận hai tệp Word + PDF; PDF xuất ra từ chính tệp Word này.
SUBMIT_NAME  ?= 24410300_NgoManhHung_DATN

docx-khoa-luan: ## Xuất đồ án (gvhd/khoa-luan.md) ra Word theo biểu mẫu CITD + quy định UIT
	@$(UV) run --no-project tools/md_to_docx.py docs/gvhd/khoa-luan.md \
		--out $(WORD_DIR)/$(SUBMIT_NAME).docx --uit

# Sơ đồ UML vẽ bằng mermaid-cli; PUPPETEER_EXECUTABLE_PATH trỏ tới Chrome/Edge có sẵn để
# không phải tải thêm Chromium. Biểu đồ số đo đọc thẳng từ docs/results/.
figures-app: ## Chụp 6 ảnh màn hình ứng dụng cho Chương 3 (cần out/ đã build + model thật)
	@# UV_NO_SYNC=1: fixtures chạy service bằng `uv run`, không có cờ này thì uv đồng bộ
	@# venv về wheel pywhispercpp CPU và ảnh sẽ ghi thiết bị ASR là CPU. Chạy make setup-vulkan trước.
	cd $(DESKTOP_DIR) && UV_NO_SYNC=1 $(NPX) playwright test --config playwright.shots.config.ts

figures-khoa-luan: ## Vẽ lại hình của khóa luận (docs/gvhd/khoa-luan-hinh/)
	@cd docs/gvhd/khoa-luan-hinh && for f in src/*.mmd; do \
		PUPPETEER_SKIP_DOWNLOAD=1 npx -y @mermaid-js/mermaid-cli@11 -p src/puppeteer.json \
			-c src/mermaid.json -b white -s 2 -i "$$f" -o "$$(basename $$f .mmd).png" >/dev/null; \
	done
	@$(UV) run --no-project docs/gvhd/khoa-luan-hinh/src/charts.py

health: ## Gọi thử endpoint /health của AI service
	@curl -s http://127.0.0.1:8756/health && echo

docs: ## Mở tài liệu API (Swagger UI, chạy cục bộ không cần mạng)
	@open http://127.0.0.1:8756/docs 2>/dev/null || echo "Mở http://127.0.0.1:8756/docs"

test: test-service test-desktop ## Chạy test CẢ HAI app

test-service: ## Test service (pytest)
	cd $(AI_DIR) && $(UV) run pytest -q

test-desktop: ## Test desktop (vitest)
	cd $(DESKTOP_DIR) && $(NPM) test

e2e: ## E2E trên app Electron thật + AI service thật (tự build lại desktop trước)
	cd $(DESKTOP_DIR) && $(NPM) run e2e

bench: ## Đo độ trễ từng khâu trên máy này (cần AI service đang chạy)
	@curl -s -X POST http://127.0.0.1:8756/api/benchmark \
		-H 'Content-Type: application/json' -d '{"source":"vi","target":"en"}' && echo

accuracy: ## Đo WER/chrF trên bộ câu kiểm thử (nạp model riêng, chạy vài phút)
	cd $(AI_DIR) && $(UV) run python scripts/accuracy.py

soak: ## Chạy liên tục 60 phút kiểm tra ổn định (cần AI service đang chạy)
	cd $(AI_DIR) && $(UV) run python scripts/soak.py --minutes $(MINUTES) \
		$(if $(AUDIO),--audio $(abspath $(AUDIO))) --json soak-report.json

segment: ## Cắt bản ghi dài thành bộ câu để đo WER (make segment MEDIA=file.mov)
	@test -n "$(MEDIA)" || { echo "Thiếu MEDIA: make segment MEDIA=ban-ghi.mov [PREFIX=vlog]"; exit 1; }
	cd $(AI_DIR) && $(UV) run python scripts/segment_audio.py $(abspath $(MEDIA)) --prefix $(PREFIX)

fetch-fleurs: ## Tải trước dữ liệu FLEURS (make fetch-fleurs LANGS="vi en" để tải lẻ)
	FLEURS_CACHE=$(FLEURS_CACHE) $(AI_DIR)/scripts/fetch_fleurs.sh $(LANGS)

eval-asr: ## WER/CER của ASR trên FLEURS, mục 3a (LIMIT=20 chạy thử; ADAPTER/MODEL/JSON đổi runtime)
	cd $(AI_DIR) && $(EVAL_ENV) $(UV) run --group eval python scripts/eval_asr.py  $(if $(LIMIT),--limit $(LIMIT)) $(if $(ADAPTER),--adapter $(ADAPTER)) $(if $(MODEL),--model $(MODEL)) --json $(JSON)

eval-mt: ## spBLEU/chrF++ trên 6 chiều dịch, mục 3b (make eval-mt LIMIT=30)
	cd $(AI_DIR) && $(EVAL_ENV) $(UV) run --group eval python scripts/eval_mt.py  $(if $(LIMIT),--limit $(LIMIT)) --json eval-mt.json

eval-comet: ## Chấm COMET cho eval-mt.json — chạy ở môi trường riêng, mục 3b
	cd $(AI_DIR) && $(UV) run --no-project scripts/eval_comet.py eval-mt.json

eval-latency: ## Total Inference Time + RTF toàn hệ thống, mục 3c (make eval-latency LIMIT=20)
	cd $(AI_DIR) && $(EVAL_ENV) $(UV) run --group eval python scripts/eval_latency.py  $(if $(LIMIT),--limit $(LIMIT)) --json eval-latency.json

# Sáu chiều trong một lệnh. Trước đây phải gõ tay sáu lượt `eval_latency.py --source …`
# nên bảng ở docs/05 mục 8c khó dựng lại; mỗi chiều ghi ra một file riêng đúng tên mà
# docs/results đang dùng. SUFFIX để tách lượt chạy của máy khác: SUFFIX=-win.
DIRS ?= vi:en en:vi vi:ja ja:vi vi:zh zh:vi
eval-latency-all: ## Đo độ trễ CẢ SÁU chiều (make eval-latency-all LIMIT=50 SUFFIX=-win)
	@for d in $(DIRS); do 		src=$${d%%:*}; tgt=$${d##*:}; 		echo "▶ $$src → $$tgt"; 		(cd $(AI_DIR) && $(EVAL_ENV) $(UV) run --group eval python scripts/eval_latency.py 			--source $$src --target $$tgt $(if $(LIMIT),--limit $(LIMIT)) 			--json eval-latency-$$src-$$tgt$(SUFFIX).json) || exit 1; 	done

endpointing: ## So ngưỡng tách câu của VAD trên một bản ghi (make endpointing MEDIA=file.mov)
	@test -n "$(MEDIA)" || { echo "Thiếu MEDIA: make endpointing MEDIA=ban-ghi.mov"; exit 1; }
	cd $(AI_DIR) && $(UV) run python scripts/endpointing.py $(abspath $(MEDIA))

clean: ## Xóa venv, node_modules và build output (kể cả bundle service + bộ cài)
	rm -rf $(AI_DIR)/.venv
	rm -rf $(DESKTOP_DIR)/node_modules $(DESKTOP_DIR)/out $(DESKTOP_DIR)/dist
	rm -rf dist/service dist/installer
