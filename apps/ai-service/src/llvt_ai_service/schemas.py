"""DTO Pydantic cho REST/WS (tách khỏi domain model thuần)."""

from __future__ import annotations

from pydantic import BaseModel

from llvt_ai_service.domain.enums import (
    AudioSource,
    Language,
    Preset,
    SessionMode,
    UtteranceStatus,
)


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    offlineReady: bool
    platform: str


class StageInfoSchema(BaseModel):
    """Một khâu pipeline với model + thiết bị THẬT của provider đang chạy."""

    stage: str
    adapter: str
    model: str
    accel: str
    loaded: bool


class ConfigResponse(BaseModel):
    preset: Preset
    availablePresets: list[Preset]
    stages: list[StageInfoSchema] = []
    modelsDir: str = ""
    # False khi biến môi trường LLVT_MODELS_DIR đang quyết định → giao diện không đổi được.
    modelsDirEditable: bool = True
    # Nơi lưu lịch sử + có đang lưu hay không (SPEC 14.4 yêu cầu hiện rõ cho người dùng).
    historyDbPath: str = ""
    historyEnabled: bool = True


class InstalledModelSchema(BaseModel):
    name: str
    stage: str
    path: str
    sizeBytes: int


class StageProgressSchema(BaseModel):
    """Tiến trình nạp của một khâu.

    `doneBytes` là số byte ĐO ĐƯỢC trên đĩa. `totalBytes` có thể là `None` khi không
    biết dung lượng model — lúc đó `percent` cũng `None` và giao diện chỉ hiện số MB,
    không bịa ra phần trăm. `estimated` = tổng là số xấp xỉ (hiện kèm dấu ≈).
    """

    stage: str
    model: str
    status: str  # waiting | downloading | loading | done | failed
    doneBytes: int
    totalBytes: int | None
    estimated: bool
    percent: float | None
    note: str


class LoadProgressResponse(BaseModel):
    active: bool
    currentStage: str | None
    overallPercent: float | None
    error: str | None
    stages: list[StageProgressSchema]


class ConfigUpdate(BaseModel):
    preset: Preset
    # None = giữ nguyên; bật/tắt lưu lịch sử không cần nạp lại model.
    historyEnabled: bool | None = None
    # None = giữ nguyên. Đổi thư mục model sẽ giải phóng provider đang nạp.
    modelsDir: str | None = None


class DeletedModels(BaseModel):
    """Kết quả xoá model đã tải."""

    removed: list[str]
    freedBytes: int


class StorageItemSchema(BaseModel):
    """Một kho dữ liệu trên đĩa của service."""

    # "models" = thư mục model, "history" = file SQLite lịch sử.
    key: str
    path: str
    sizeBytes: int


class StorageResponse(BaseModel):
    """Dung lượng đĩa mà service đang chiếm, tính theo từng kho."""

    items: list[StorageItemSchema]
    totalBytes: int


class SessionSummary(BaseModel):
    id: str
    title: str = ""
    startedAtMs: int
    endedAtMs: int | None = None
    mode: SessionMode | None = None
    preset: Preset | None = None
    utteranceCount: int = 0


class UtteranceSchema(BaseModel):
    """Một câu đã chạy qua pipeline (SPEC 7.11 — không kèm audio)."""

    id: str
    source: AudioSource
    sourceLanguage: Language
    targetLanguage: Language
    sourceText: str | None = None
    translatedText: str | None = None
    asrMs: int | None = None
    mtMs: int | None = None
    ttsMs: int | None = None
    status: UtteranceStatus
    error: str | None = None
    startedAtMs: int
    endedAtMs: int | None = None


class SessionDetail(SessionSummary):
    utterances: list[UtteranceSchema] = []


class SessionUpdate(BaseModel):
    title: str | None = None
    # Đóng một phiên bị bỏ dở (app tắt giữa phiên nên không có `session.stop`):
    # mốc kết thúc lấy theo câu cuối cùng đã lưu, không phải thời điểm bấm nút.
    close: bool | None = None


class BenchmarkRequest(BaseModel):
    source: Language = Language.vi
    target: Language = Language.en


class BenchmarkResponse(BaseModel):
    """Thời gian THỰC TẾ của từng khâu trên máy đang chạy (không đo độ chính xác)."""

    vadMs: int
    asrMs: int
    mtMs: int
    ttsMs: int | None = None  # None khi máy chưa tải được voice cho ngôn ngữ đích
    totalMs: int
    audioMs: int  # độ dài đoạn audio mẫu đưa vào VAD/ASR
    source: Language
    target: Language
    preset: Preset | None = None


class TranscriptSegmentSchema(BaseModel):
    """Một đoạn giọng nói trong tệp; mốc thời gian tính từ đầu tệp."""

    startedAtMs: int
    endedAtMs: int
    text: str
    translatedText: str | None = None
    asrMs: int | None = None
    mtMs: int | None = None


class TranscriptionResponse(BaseModel):
    source: Language
    target: Language | None = None  # None = chỉ nhận dạng chữ, không dịch
    audioMs: int
    processingMs: int
    segments: list[TranscriptSegmentSchema] = []
    # Phiên tương ứng trong lịch sử; rỗng khi không lưu (hoặc lưu lịch sử đang tắt).
    sessionId: str = ""
    # True = dừng giữa chừng theo yêu cầu; `segments` chỉ là phần đã chạy được.
    cancelled: bool = False


class TranscribeProgressResponse(BaseModel):
    """Tiến trình của tệp đang xử lý — đo theo vị trí đã chạy qua, không ước lượng."""

    active: bool
    fileName: str
    audioMs: int
    doneMs: int
    segments: int
    percent: float | None
    error: str | None
    # Đã xin dừng nhưng khúc đang chạy chưa xong.
    cancelling: bool = False


class ResourceResponse(BaseModel):
    """Tài nguyên của chính tiến trình AI service (renderer không tự đọc được)."""

    cpuPercent: float
    cpuCount: int
    rssMb: float
    systemTotalMb: float
    systemUsedPercent: float
    threads: int
