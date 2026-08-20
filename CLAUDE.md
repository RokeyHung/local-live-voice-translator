# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Near-real-time, **fully local** speech translation desktop app (đồ án tốt nghiệp). Two-way meeting translation (Google Meet) for Vietnamese ↔ English / Japanese / Chinese, targeting Windows 11 x64 and macOS 13+ Apple Silicon. No cloud during translation.

Pipeline: `Audio → VAD (Silero) → ASR (whisper.cpp) → MT (NLLB-200) → TTS (sherpa-onnx) → Virtual Mic`.

The authoritative spec lives in `docs/`: `00_project-outline.md` (đề cương — source of truth), `01`/`02` SPECs, `03_week1-survey-and-foundation.md`. When a decision conflicts, docs/00 wins. Work is organized week-by-week (see the plan table in docs/00): VAD=T2, ASR=T3, MT=T4, TTS=T5, desktop UI=T6, two-way/virtual mic=T7, measurement=T8 — all implemented with real models, each with a note in `docs/` (`04`–`10`); `11` covers the post-T8 batch (history, settings, model lifecycle) and `16` the file-import screen. End-user docs: `12` install, `13` virtual mic + Google Meet. Remaining: real Google Meet + Windows 11 runs, a 60-minute soak with real models, a human-voice accuracy corpus, and T9 (report, packaging, demo).

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
make format    # sort imports + format BOTH apps and docs/ (ianvs prettier plugin + ruff isort)
make format-docs  # prettier over docs/*.md + root *.md only (root .prettierrc.yaml)
make health    # curl GET /health
make bench     # per-stage latency (service must be running)
make accuracy  # WER/chrF over scripts/accuracy_corpus.json
make soak MINUTES=60  # long-run stability check (service must be running)
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
- `adapters/` — real impls: `asr/whisper_cpp.py` (pywhispercpp), `mt/nllb.py` (transformers), `tts/sherpa_onnx.py` (vi/en/zh), `tts/kokoro_ja.py` (Japanese — sherpa-onnx has no working Japanese front-end, so this one pairs the Kokoro ONNX model with misaki/OpenJTalk G2P), `vad/silero.py`, `persistence/sqlite.py` (session history, SQLAlchemy Core) + `persistence/memory.py` (in-memory, used by tests). `asr/faster_whisper.py` is the only remaining stub (optimization phase).
- `application/` — `TranslationPipeline` (VAD→ASR→MT→TTS, calls only ports; also persists each finished utterance), `transcribe.py` (batch file import: VAD→ASR→MT over a whole file, no TTS — a separate use case, not a mode of the pipeline), `ModelManager` (registry mapping adapter-name→factory, `load_preset()`), `SessionService`/`SessionController` (per-connection), `HistoryPolicy` (port-implementing decorator that turns history writes off — SPEC 14.4 privacy opt-out), `LanguageRoutedTts` (picks the TTS engine per target language; policy, so it lives here rather than in an adapter), `SerialExecutor` (runs blocking model calls in a thread + lock, since whisper.cpp contexts are not thread-safe), `Container` (DI holder).
- `config/` — `settings.py` (pydantic-settings, `LLVT_` env prefix), `presets.py` (Fast/Balanced/Quality → adapter+model choices).
- `api/` + `ws/` — thin transport. `app.py` builds the `Container` in the FastAPI **lifespan** and attaches it to `app.state`; routes get it via `api/deps.py`.

Key flow: lifespan → `ModelManager.select_preset(default)` (records the preset, loads **nothing**) → WS `/ws` creates a `SessionController` per connection → messages drive `TranslationPipeline` → domain `PipelineEvent`s are converted to JSON by `ws/protocol.py` and streamed back.

Models are loaded **on demand**, never at startup (startup is ~0.4s instead of ~45s): `POST /api/models/load` (the "Khởi động model" button), the first `session.start`, or `POST /api/benchmark` all funnel through `ModelManager.ensure_loaded()`. `LLVT_PRELOAD_MODELS=true` restores eager loading for headless runs. An empty `stages` array in `GET /api/config` is the wire-level signal for "nothing in memory yet" — the UI keys its status badge off it.

**Adding a new backend** (e.g. MLX Whisper): implement the port in `adapters/`, add one line to the relevant registry in `application/model_manager.py`, point a preset at it in `config/presets.py`. Do not touch `application/pipeline.py` or transport.

### desktop renderer (`src/renderer/src/`)

Same layering: `domain/` (enums/events/models), `ports/` (`AiClient`, `SessionChannel`), `adapters/` (`HttpAiClient` REST, `WsSessionChannel` WebSocket), `application/` (`config.ts`, `SessionController`), `stores/` (Zustand `session-store`), `hooks/` (`use-health`, `use-session` — bridge React↔application), `ui/` (presentational `App` + components).

`App.tsx` mounts **every screen once and keeps it mounted**, switching tabs only toggles `display:none` (`<Screen show>`); screen-local state (the import queue and its in-flight run, search boxes, drafts) must survive tab switches. The cost is that hidden screens keep running their hooks, so any query with a `refetchInterval` has to gate on `useIsScreen('<id>')` — see `useResources` in Diagnostics/Setup and `useSessions` in History. UI/hooks/application depend on **ports**, not concrete adapters. Electron `main/` + `preload/` are minimal; preload exposes `window.llvt` (AI service URLs + platform), consumed by `application/config.ts`.

## Contract sync (important)

The WebSocket/REST contract is defined twice and MUST stay in sync when changed:

- Python: `apps/ai-service/src/llvt_ai_service/ws/protocol.py` + `schemas.py`
- TypeScript mirror: `apps/desktop/src/renderer/src/domain/{events,models,enums}.ts`

WS envelope is `{ type, ts, payload }`. Message types: client→`session.start` (carries the history `title`)/`session.stop`/`audio.chunk`/`control.ptt`/`control.mute`; server→`state` (carries `sessionId` at session start/stop so the client can point at the right history row)/`asr.partial`/`asr.final`/`mt.result`/`tts.audio`/`metrics`/`error`.

REST: `GET /health`, `GET|PUT /api/config` (preset + real per-stage model/device from the loaded providers, plus `modelsDir`/`historyDbPath`/`historyEnabled`), `GET|DELETE /api/models` (what's actually on disk with real sizes; DELETE removes only the dirs the app created), `POST /api/models/load` (`?reload=true` rebuilds) and `POST /api/models/unload`, `GET /api/models/progress` (per-stage load/download progress, polled by the UI _while_ the blocking load runs), `POST /api/benchmark` (stage latency — always warms models up first), `GET /api/resources` (service process CPU/RSS via psutil), `GET /api/storage` (real disk usage per store — models dir + history SQLite; the desktop adds its own Chromium cache size from the main process), `POST /api/transcribe` (batch import of an audio **or video** file — the desktop extracts the audio track with Chromium's `decodeAudioData` and uploads PCM16 mono 16 kHz, or a WAV, `?source=&target=&name=&save=`; one file at a time, 409 if busy), `GET /api/transcribe/progress` (position-in-file progress, polled while the blocking POST runs) and `POST /api/transcribe/cancel` (the POST then returns normally with `cancelled: true` and the segments finished so far — uvicorn does **not** cancel a handler when the client disconnects, so dropping the request is not a way to stop a run).

Settings the user can change from the app (currently `modelsDir`) are written to `~/.llvt/settings.json` by `config/runtime_config.py` and read back as a pydantic-settings source that ranks **below** env vars — `LLVT_MODELS_DIR` wins and the API then returns `modelsDirEditable: false` / 409. Changing `modelsDir` unloads the providers instead of reloading them (the new folder is usually empty, so reloading would download GBs inside the request); `ModelManager.ensure_loaded()` re-loads them when the next session starts.

Session history: `GET /api/sessions` (`?q=` searches titles + utterance text), `GET /api/sessions/{id}` (bilingual transcript), `PATCH /api/sessions/{id}` (`title` to rename, `close` to close a session abandoned by a crash), `DELETE /api/sessions/{id}`, `DELETE /api/sessions` (clear all). Rows are written by the pipeline as each utterance finishes; the desktop History screen reads only from here (no localStorage copy).

API docs live at `/docs` (`make docs`). Swagger UI assets are **vendored** in `llvt_ai_service/static/` and served from `/static` — FastAPI's default CDN would make the docs page blank on an offline machine, which contradicts the whole project. ReDoc is disabled for the same reason. The WS contract can't be expressed in OpenAPI, so it's written into the app description in `api/openapi_meta.py` — keep it in sync with `ws/protocol.py`.

## Conventions

- **Scaffold with official CLIs**, not hand-written boilerplate: `uv init` for Python, `npm create @quick-start/electron` (electron-vite) for the desktop. Add libs via `uv add` / `npm i`.
- Python: uv-managed, pinned to **3.12** (spec requires 3.11/3.12), src-layout package `llvt_ai_service`, entry point `llvt-ai-service`. ruff line-length 100, isort enabled.
- The AI service must bind `127.0.0.1` only — never expose to LAN/Internet.
- Audio internal format for ASR: PCM signed 16-bit, mono, 16 kHz.
- Commits go directly to `main` (solo project). A global pre-commit hook runs Gitleaks + git identity checks.
