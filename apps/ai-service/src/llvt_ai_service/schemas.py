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


class ComputeDeviceSchema(BaseModel):
    """Một GPU mà whisper.cpp thấy được qua ggml."""

    id: str  # tên thật của card — cũng là giá trị gửi lên PUT /api/compute
    backend: str  # "Vulkan" | "Metal" | "CUDA"
    kind: str  # "discrete" | "integrated"
    memoryMb: int | None = None


class ComputeResponse(BaseModel):
    """Phần cứng service THẤY và lựa chọn thiết bị đang lưu.

    Khác ô phần cứng cũ đọc từ renderer: Chromium chỉ thấy GPU nó dùng để vẽ giao
    diện (trên laptop hybrid là GPU tích hợp) và chặn RAM ở 8 GB.
    """

    choice: str  # "auto" | "cpu" | id của một GPU trong `devices`
    devices: list[ComputeDeviceSchema]
    # GPU cụ thể chọn được hay không. Chỉ khi whisper.cpp liệt kê được thiết bị (bản
    # Windows Vulkan); macOS chỉ có một GPU nên chỉ còn "Tự động"/"Chỉ CPU".
    deviceSelectable: bool
    activeDevice: str | None  # thiết bị ASR đang chạy; None = chưa nạp / không biết
    asrAdapter: str | None  # runtime ASR đang nạp — MLX không đổi thiết bị được
    platform: str
    cpuName: str
    cpuCores: int | None
    ramGb: float | None


class ComputeUpdate(BaseModel):
    choice: str


class StageInfoSchema(BaseModel):
    """Một khâu pipeline với model + thiết bị THẬT của provider đang chạy."""

    stage: str
    adapter: str
    model: str
    accel: str
    loaded: bool


class CustomChoiceSchema(BaseModel):
    """Bộ model người dùng tự chọn cho preset `custom`, kèm những lựa chọn có thật.

    Danh sách lựa chọn lấy từ chính registry của service chứ không chép tay ở giao
    diện — thêm một adapter mới là ô chọn tự có thêm mục, không phải sửa hai nơi.
    """

    asrAdapter: str
    asrModel: str
    mtModel: str
    asrAdapterChoices: list[str] = []
    # Model ASR theo TỪNG runtime: ba runtime dùng ba định dạng khác nhau nên không có
    # model nào dùng chung được. Giao diện lọc theo runtime đang chọn.
    asrModelChoices: dict[str, list[str]] = {}
    mtModelChoices: list[str] = []


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
    # Tách người nói có đang bật không (LLVT_DIARIZATION_ENABLED). Chỉ có tác dụng ở
    # màn Nhập tệp; giao diện dùng nó để biết có chỗ nào hiện nhãn người nói hay
    # không, thay vì đoán theo việc `stages` có khâu DIA.
    diarizationEnabled: bool = False

    # --- Token HuggingFace (tải model gated) ---
    #
    # KHÔNG bao giờ trả nguyên văn token. Giao diện chỉ cần biết đã có hay chưa, nó
    # đến từ đâu, và một đoạn che đủ để nhận ra đang dùng token nào.
    hfTokenSet: bool = False
    # "env" = LLVT_HF_TOKEN (app không sửa được) · "saved" = ô nhập trong app ·
    # "inherited" = biến HF_TOKEN người dùng tự export · "none" = chưa có.
    hfTokenSource: str = "none"
    hfTokenHint: str = ""
    # False khi LLVT_HF_TOKEN đang quyết định → giao diện khoá ô nhập lại.
    hfTokenEditable: bool = True

    # Bộ model của preset `custom` (kể cả khi đang chạy preset khác) — giao diện cần
    # nó để vẽ sẵn ô "Tự chọn".
    custom: CustomChoiceSchema | None = None


class InstalledModelSchema(BaseModel):
    name: str
    stage: str
    path: str
    sizeBytes: int
    # False = tải dở dang: có trên đĩa nhưng chưa đủ file, nạp sẽ hỏng. Giao diện phải
    # gắn nhãn riêng và không được tính nó là "đã tải".
    complete: bool = True


class StageProgressSchema(BaseModel):
    """Tiến trình nạp của một khâu.

    `doneBytes` là số byte ĐO ĐƯỢC trên đĩa. `totalBytes` có thể là `None` khi không
    biết dung lượng model — lúc đó `percent` cũng `None` và giao diện chỉ hiện số MB,
    không bịa ra phần trăm. `estimated` = tổng là số xấp xỉ (hiện kèm dấu ≈).
    """

    stage: str
    model: str
    status: str  # waiting | downloading | loading | done | failed | cancelled
    doneBytes: int
    totalBytes: int | None
    estimated: bool
    percent: float | None
    note: str


class LoadProgressResponse(BaseModel):
    active: bool
    # Đã bấm Huỷ nhưng khâu đang chạy chưa xong (giống `cancelling` của nhập tệp).
    cancelling: bool = False
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
    # None = giữ nguyên, chuỗi rỗng = XOÁ token đã lưu. Trả 409 nếu LLVT_HF_TOKEN
    # đang quyết định.
    hfToken: str | None = None
    # Lựa chọn cho preset `custom`. None = giữ nguyên, chuỗi rỗng = trả khâu đó về
    # mặc định (theo Balanced). Lưu lại kể cả khi đang chạy preset khác.
    customAsrAdapter: str | None = None
    customAsrModel: str | None = None
    customMtModel: str | None = None


class HfVerifyRequest(BaseModel):
    # Bỏ trống = kiểm tra token đang có hiệu lực (đã lưu hoặc từ môi trường). Có giá
    # trị = thử token này mà KHÔNG lưu, để người dùng dán vào rồi bấm kiểm tra trước.
    token: str = ""


class HfVerifyResponse(BaseModel):
    """Kết quả hỏi huggingface.co xem token có dùng được không."""

    ok: bool
    # Tên tài khoản HF khi token hợp lệ; rỗng khi không.
    user: str = ""
    # Lý do khi không hợp lệ (hết hạn, sai, hoặc không có mạng).
    error: str = ""


class DownloadRequest(BaseModel):
    """Model cần tải: đường dẫn thật ở thượng nguồn."""

    name: str
    # Runtime sẽ chạy model này. CHỈ cần khi `name` không có trong danh mục — lúc đó
    # `org/repo` nào cũng giống nhau nên service không suy ra được. Giá trị:
    # whisper_cpp | mlx | faster_whisper | nllb | pyannote.
    kind: str = ""
    # Xoá bản đang có rồi tải lại từ đầu. Cần cho bản tải dở mà máy không tự nhận ra
    # được — mọi đường tải đều bỏ qua model "đã có", nên nếu không có cờ này thì một
    # file cụt sẽ nằm đó vĩnh viễn.
    force: bool = False


class DownloadedModel(BaseModel):
    name: str
    stage: str  # ASR | MT | TTS | DIA
    path: str  # nơi model vừa được tải về


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
    # Mã người nói (`speaker-1`, `speaker-2`…) khi phiên là một tệp nhập có bật
    # diarization. null với phiên trực tiếp — ở đó `source` đã cho biết ai nói.
    # Giao diện tự dựng câu chữ hiển thị theo ngôn ngữ đang chọn.
    speaker: str | None = None


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
    # Mã người nói khi bật diarization; null = không bật, hoặc đoạn rơi vào chỗ
    # chuyển lượt nên không ai chiếm đủ đa số thời lượng.
    speaker: str | None = None


class TranscriptionResponse(BaseModel):
    source: Language
    target: Language | None = None  # None = chỉ nhận dạng chữ, không dịch
    audioMs: int
    processingMs: int
    segments: list[TranscriptSegmentSchema] = []
    # Số người nói diarization tìm được; 0 = không chạy diarization cho tệp này.
    speakerCount: int = 0
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
    # Giai đoạn đang chạy: "diarizing" (gom cụm giọng trên cả tệp, `percent` còn 0)
    # hay "transcribing" (nhận dạng + dịch theo từng đoạn).
    phase: str = "transcribing"


class EvaluationCaseSchema(BaseModel):
    """Một câu mẫu người dùng đưa vào để chấm."""

    id: str
    language: Language
    target: Language
    transcript: str  # câu gốc chuẩn — vừa là tham chiếu ASR, vừa là đầu vào MT
    translation: str  # bản dịch tham chiếu
    # Đường dẫn TUYỆT ĐỐI tới file WAV giọng đọc thật. Bỏ trống thì service tự đọc câu
    # tham chiếu bằng TTS rồi nghe lại (`audioSource` của kết quả sẽ là tts-roundtrip).
    audio: str = ""


class EvaluationRequest(BaseModel):
    # Bỏ trống = chạy bộ câu mẫu đi kèm service (GET /api/evaluate/corpus).
    cases: list[EvaluationCaseSchema] = []
    # Chỉ chạy N câu đầu — để thử nhanh trước khi chạy cả bộ.
    limit: int | None = None


class EvaluationCaseResultSchema(BaseModel):
    id: str
    language: Language
    target: Language
    # "recorded" = giọng người thật · "tts-roundtrip" = máy tự đọc rồi tự nghe lại
    audioSource: str
    reference: str
    hypothesis: str
    errorRate: float
    metric: str  # "WER" cho vi/en · "CER" cho zh/ja
    referenceTranslation: str
    translation: str
    chrf: float
    asrMs: int
    mtMs: int
    audioMs: int


class EvaluationResponse(BaseModel):
    """Kết quả chấm: từng câu + bảng tổng (độ trễ báo p50/p90, không báo trung bình)."""

    cases: list[EvaluationCaseResultSchema] = []
    errorRate: float = 0.0
    chrf: float = 0.0
    asrP50Ms: int = 0
    asrP90Ms: int = 0
    mtP50Ms: int = 0
    mtP90Ms: int = 0
    totalP90Ms: int = 0
    rtfP90: float = 0.0
    # True khi có ít nhất một câu chạy bằng giọng tổng hợp — số sẽ LẠC QUAN hơn thực
    # tế, giao diện phải nói rõ.
    hasSyntheticAudio: bool = False
    cancelled: bool = False


class EvaluationProgressResponse(BaseModel):
    active: bool
    total: int
    done: int
    currentCase: str
    percent: float | None
    error: str | None
    cancelling: bool = False


class ResourceResponse(BaseModel):
    """Tài nguyên của chính tiến trình AI service (renderer không tự đọc được)."""

    cpuPercent: float
    cpuCount: int
    rssMb: float
    systemTotalMb: float
    systemUsedPercent: float
    threads: int
