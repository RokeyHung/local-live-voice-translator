# Local Live Voice Translator — dev shortcuts
# Yêu cầu: `uv` và `npm` có trên PATH.
# Nếu uv chưa có trên PATH: source "$HOME/.local/bin/env" (hoặc mở lại terminal).

AI_DIR      := apps/ai-service
DESKTOP_DIR := apps/desktop
UV          ?= uv
NPM         ?= npm
# Prettier dùng chung cho Markdown (đến từ node_modules của desktop)
PRETTIER    := $(DESKTOP_DIR)/node_modules/.bin/prettier
# Thời lượng của `make soak` (đổi bằng: make soak MINUTES=5)
MINUTES     ?= 60
# Tiền tố tên file của `make segment` (make segment MEDIA=x.mov PREFIX=vlog)
PREFIX      ?= rec

.DEFAULT_GOAL := help

.PHONY: help setup setup-service setup-desktop dev service desktop preview \
        build typecheck lint format format-docs health docs test bench accuracy soak segment clean

help: ## Hiện danh sách lệnh
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

setup: setup-service setup-desktop ## Cài phụ thuộc cho cả hai app

setup-service: ## Cài phụ thuộc Python (uv sync)
	cd $(AI_DIR) && $(UV) sync

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

lint: ## Lint desktop (eslint) + service (ruff)
	cd $(DESKTOP_DIR) && $(NPM) run lint
	cd $(AI_DIR) && $(UV) run ruff check .

format: format-docs ## Sort imports + format cả hai app và tài liệu Markdown
	cd $(DESKTOP_DIR) && $(NPM) run format
	cd $(AI_DIR) && $(UV) run ruff check --select I --fix . && $(UV) run ruff format .

format-docs: ## Format Markdown ở docs/ và thư mục gốc (prettier, cấu hình .prettierrc.yaml)
	@test -x $(PRETTIER) || { echo "Chưa có prettier — chạy 'make setup-desktop' trước."; exit 1; }
	$(PRETTIER) --write "docs/**/*.md" "*.md"

health: ## Gọi thử endpoint /health của AI service
	@curl -s http://127.0.0.1:8756/health && echo

docs: ## Mở tài liệu API (Swagger UI, chạy cục bộ không cần mạng)
	@open http://127.0.0.1:8756/docs 2>/dev/null || echo "Mở http://127.0.0.1:8756/docs"

test: ## Chạy test service (pytest)
	cd $(AI_DIR) && $(UV) run pytest -q

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

clean: ## Xóa venv, node_modules và build output
	rm -rf $(AI_DIR)/.venv
	rm -rf $(DESKTOP_DIR)/node_modules $(DESKTOP_DIR)/out $(DESKTOP_DIR)/dist
