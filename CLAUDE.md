# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Near-real-time, **fully local** speech translation desktop app (đồ án tốt nghiệp). Two-way meeting translation (Google Meet) for Vietnamese ↔ English / Japanese / Chinese, targeting Windows 11 x64 and macOS 13+ Apple Silicon. No cloud during translation.

Pipeline: `Audio → VAD (Silero) → ASR (whisper.cpp) → MT (NLLB-200) → TTS (sherpa-onnx) → Virtual Mic`.

The authoritative spec lives in `docs/`: `00_project-outline.md` (đề cương — source of truth), `01`/`02` SPECs, `03_week1-survey-and-foundation.md`. When a decision conflicts, docs/00 wins. Work is organized week-by-week (see the plan table in docs/00); adapters are stubbed with the week they get implemented (VAD=T2, ASR=T3, MT=T4, TTS=T5, SQLite repo=T6).

## Repository layout

Two processes under `apps/`, communicating over REST + WebSocket on `127.0.0.1` only:

- `apps/ai-service` — Python local AI service (FastAPI + WebSocket + SQLite). Runs VAD/ASR/MT/TTS, model management, metrics.
- `apps/desktop` — Electron desktop client (React + TypeScript, electron-vite + electron-builder). UI, audio capture/routing, device setup.

## Commands

Prefer the root `Makefile` (needs `uv` and `npm` on PATH; if `uv` was just installed: `source "$HOME/.local/bin/env"`):

```bash
make setup     # install deps for both apps (uv sync + npm install)
make dev       # run AI service + desktop together (Ctrl+C stops both)
make service   # run AI service only (http://127.0.0.1:8756)
make desktop   # run desktop only (electron-vite dev)
make build     # typecheck + build desktop
make test      # pytest for ai-service
make lint      # eslint (desktop) + ruff check (service)
make format    # sort imports + format BOTH apps (ianvs prettier plugin + ruff isort)
make health    # curl GET /health
make clean     # remove .venv, node_modules, build output
```

Per-app / single-test:

```bash
# ai-service (run from apps/ai-service)
uv run pytest -q
uv run pytest tests/test_health.py::test_ws_session_start   # single test
uv run ruff check .            # lint (rule "I" = import sort)
uv run llvt-ai-service         # start server

# desktop (run from apps/desktop)
npm run typecheck              # tsc for both node + web configs
npm run dev
```

## Architecture — both apps use Hexagonal (Ports & Adapters)

The core discipline everywhere: **dependencies point inward** — `adapters → ports ← application → domain`. `domain` imports nothing; `application` depends only on `ports` + `domain`; adapters and transport are the replaceable outer ring. This is why models/runtimes/transports are swappable without touching pipeline or UI. `apps/ai-service/ARCHITECTURE.md` documents it in detail.

### ai-service (`src/llvt_ai_service/`)

- `domain/` — pure `enums`, `models`, `events` (dataclasses; no framework imports).
- `ports/` — ABCs: `SpeechToTextProvider`, `TranslationProvider`, `TextToSpeechProvider`, `VoiceActivityDetector`, `SessionRepository`. All AI providers extend `Provider` (async `load()`/`unload()`).
- `adapters/` — concrete impls (currently **stubs** raising `NotImplementedError`): `asr/whisper_cpp.py`, `mt/nllb.py`, `tts/sherpa_onnx.py`, `vad/silero.py`, `persistence/memory.py`.
- `application/` — `TranslationPipeline` (VAD→ASR→MT→TTS, calls only ports), `ModelManager` (registry mapping adapter-name→factory, `load_preset()`), `SessionService`/`SessionController` (per-connection), `SerialExecutor` (runs blocking model calls in a thread + lock, since whisper.cpp contexts are not thread-safe), `Container` (DI holder).
- `config/` — `settings.py` (pydantic-settings, `LLVT_` env prefix), `presets.py` (Fast/Balanced/Quality → adapter+model choices).
- `api/` + `ws/` — thin transport. `app.py` builds the `Container` in the FastAPI **lifespan** and attaches it to `app.state`; routes get it via `api/deps.py`.

Key flow: lifespan → `ModelManager.load_preset(default)` → WS `/ws` creates a `SessionController` per connection → messages drive `TranslationPipeline` → domain `PipelineEvent`s are converted to JSON by `ws/protocol.py` and streamed back.

**Adding a new backend** (e.g. MLX Whisper): implement the port in `adapters/`, add one line to the relevant registry in `application/model_manager.py`, point a preset at it in `config/presets.py`. Do not touch `application/pipeline.py` or transport.

### desktop renderer (`src/renderer/src/`)

Same layering: `domain/` (enums/events/models), `ports/` (`AiClient`, `SessionChannel`), `adapters/` (`HttpAiClient` REST, `WsSessionChannel` WebSocket), `application/` (`config.ts`, `SessionController`), `stores/` (Zustand `session-store`), `hooks/` (`use-health`, `use-session` — bridge React↔application), `ui/` (presentational `App` + components). UI/hooks/application depend on **ports**, not concrete adapters. Electron `main/` + `preload/` are minimal; preload exposes `window.llvt` (AI service URLs + platform), consumed by `application/config.ts`.

## Contract sync (important)

The WebSocket/REST contract is defined twice and MUST stay in sync when changed:

- Python: `apps/ai-service/src/llvt_ai_service/ws/protocol.py` + `schemas.py`
- TypeScript mirror: `apps/desktop/src/renderer/src/domain/{events,models,enums}.ts`

WS envelope is `{ type, ts, payload }`. Message types: client→`session.start`/`session.stop`/`audio.chunk`/`control.ptt`/`control.mute`; server→`state`/`asr.partial`/`asr.final`/`mt.result`/`tts.audio`/`metrics`/`error`.

REST: `GET /health`, `GET|PUT /api/config` (preset), `GET|DELETE /api/sessions`, `POST /api/benchmark` (stage latency — always warms models up first), `GET /api/resources` (service process CPU/RSS via psutil).

## Conventions

- **Scaffold with official CLIs**, not hand-written boilerplate: `uv init` for Python, `npm create @quick-start/electron` (electron-vite) for the desktop. Add libs via `uv add` / `npm i`.
- Python: uv-managed, pinned to **3.12** (spec requires 3.11/3.12), src-layout package `llvt_ai_service`, entry point `llvt-ai-service`. ruff line-length 100, isort enabled.
- The AI service must bind `127.0.0.1` only — never expose to LAN/Internet.
- Audio internal format for ASR: PCM signed 16-bit, mono, 16 kHz.
- Commits go directly to `main` (solo project). A global pre-commit hook runs Gitleaks + git identity checks.
