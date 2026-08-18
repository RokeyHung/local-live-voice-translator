// Từ điển nhãn giao diện (vi/en). Ngôn ngữ giao diện độc lập với ngôn ngữ dịch:
// đổi ở màn Cài đặt, không ảnh hưởng cặp ngôn ngữ của phiên.

import type { Language, UiLanguage } from '../domain/enums'

export interface Dict {
  // chung
  appName: string
  offline: string
  offlineReady: string
  noCloud: string
  serviceDown: string
  serviceDownSub: string
  notSupported: string
  notSupportedYet: string
  recoverT: string
  recoverS: string
  recoverBtn: string
  recoverDismiss: string
  // điều hướng / tiêu đề màn hình
  session: string
  setup: string
  modelMgr: string
  diagnostics: string
  history: string
  settings: string
  about: string
  importFiles: string
  // phiên dịch
  layout: string
  vSplit: string
  vTimeline: string
  vFocus: string
  meetingLangLbl: string
  myLangLbl: string
  swapLangs: string
  listen: string
  listenSub: string
  speak: string
  speakSub: string
  twoway: string
  twowaySub: string
  vizRemote: string
  vizMe: string
  mic: string
  vmic: string
  waitRemote: string
  waitMe: string
  idleHint: string
  start: string
  stop: string
  mute: string
  unmute: string
  ptt: string
  recording: string
  loopWarn: string
  remoteSourceMissing: string
  connecting: string
  // thiết lập
  setupSub: string
  micCard: string
  micRole: string
  sysCard: string
  sysRole: string
  spkCard: string
  spkRole: string
  vmicCard: string
  vmicRole: string
  deviceDefault: string
  noDevice: string
  test: string
  active: string
  ready: string
  connected: string
  deferred: string
  sysHint: string
  sysCapturing: string
  ducking: string
  instanceT: string
  instanceSub: string
  detecting: string
  gpuLbl: string
  cpuLbl: string
  ramLbl: string
  apiLbl: string
  recommended: string
  notAvail: string
  devAuto: string
  devAutoSub: string
  devCuda: string
  devMetal: string
  devVulkan: string
  devCpu: string
  devCpuSub: string
  cores: string
  atLeast: string
  computeReadOnly: string
  computeFromService: string
  sysStatus: string
  models: string
  compute: string
  vmicStatus: string
  tipTitle: string
  tipBody: string
  loopCheckT: string
  loopOk: string
  loopWarnSetup: string
  loopUnknown: string
  // model
  modelSub: string
  presetActive: string
  installed: string
  onDisk: string
  noModelsOnDisk: string
  loadIdle: string
  loadedLbl: string
  ramWarnHard: string
  ramWarnSoft: string
  mbIdleT: string
  mbIdleS: string
  mbReadyT: string
  mbReadyS: string
  mbDownT: string
  mbDownS: string
  applyingPreset: string
  presetFailed: string
  stageLbl: string
  adapterLbl: string
  customTitle: string
  customSub: string
  browseTitle: string
  browseSub: string
  browseDisabled: string
  searchPh: string
  dlBtn: string
  noCatalogResults: string
  // chẩn đoán
  diagSub: string
  latencyBreak: string
  benchTitle: string
  benchDesc: string
  benchRun: string
  benchRunning: string
  benchAgain: string
  benchIdle: string
  benchOn: string
  benchTotal: string
  benchFailed: string
  benchNote: string
  rtFactor: string
  serviceCpu: string
  serviceRam: string
  serviceThreads: string
  systemRam: string
  resourcesT: string
  audioT: string
  sampleRate: string
  frameSize: string
  utterCount: string
  wsLog: string
  clear: string
  noMessages: string
  diagEmptyT: string
  diagEmptyS: string
  endToEnd: string
  // lịch sử
  historySub: string
  clearAll: string
  meetingsTitle: string
  utter: string
  startToRec: string
  searchHistory: string
  noResultsT: string
  noResultsS: string
  emptyTranscript: string
  colTime: string
  colSrc: string
  colOriginal: string
  colTranslated: string
  colLatency: string
  renameTip: string
  deleteTip: string
  meetingPrefix: string
  historyUnavailable: string
  rowFailed: string
  // thư mục lưu model
  dirTitle: string
  dirDesc: string
  dirBrowse: string
  dirUsed: string
  dirPh: string
  dirClear: string
  dirApply: string
  dirNote: string
  dirLocked: string
  dirConfirmClear: string
  dirCleared: string
  dirNothingToClear: string
  // quyền riêng tư / lưu lịch sử
  privacyT: string
  privacyDesc: string
  historyOn: string
  historyOff: string
  historyPath: string
  historyPathUnknown: string
  historyOffNote: string
  // cài đặt
  settingsSub: string
  appearance: string
  themeDesc: string
  uiLang: string
  langDesc: string
  tSystem: string
  tLight: string
  tDark: string
  tSystemSub: string
  tLightSub: string
  tDarkSub: string
  hfTitle: string
  hfDesc: string
  hfPh: string
  hfUnused: string
  glossTitle: string
  glossDesc: string
  glossSrcPh: string
  glossDstPh: string
  glossAdd: string
  glossEmpty: string
  glossCount: string
  // giới thiệu
  aboutSub: string
  aboutTagline: string
  aboutStackT: string
  aboutPrivacyT: string
  aboutPrivacyB: string
  aboutLinksT: string
  aboutRepo: string
  aboutDocs: string
  aboutLicense: string
  aboutInspired: string
  aboutVersion: string
  aboutBuild: string
  aboutPlatform: string
  // nhập tệp
  importSub: string
  importDisabledT: string
  importDisabledS: string
  dropSub: string
  // trạng thái utterance
  stRecognizing: string
  stTranslating: string
  stSpeaking: string
  stCompleted: string
  stFailed: string
  stWaiting: string
}

const vi: Dict = {
  appName: 'Local Live Voice Translator',
  offline: 'Offline',
  offlineReady: 'Sẵn sàng Offline',
  noCloud: 'Không dùng cloud',
  serviceDown: 'Chưa kết nối AI service',
  serviceDownSub: 'Chạy `make service` rồi thử lại.',
  notSupported: 'Chưa hỗ trợ',
  notSupportedYet: 'Tính năng này cần API tương ứng bên AI service — chưa có trong bản này.',
  recoverT: 'Khôi phục phiên chưa lưu?',
  recoverS: 'Ứng dụng đã đóng khi đang ghi. Cuộc họp sau vẫn còn:',
  recoverBtn: 'Xem lại',
  recoverDismiss: 'Bỏ qua',

  session: 'Phiên dịch',
  setup: 'Thiết bị âm thanh',
  modelMgr: 'Quản lý Model',
  diagnostics: 'Chẩn đoán',
  history: 'Lịch sử',
  settings: 'Cài đặt',
  about: 'Về ứng dụng',
  importFiles: 'Nhập tệp',

  layout: 'Bố cục',
  vSplit: 'Chia đôi',
  vTimeline: 'Dòng thời gian',
  vFocus: 'Tập trung',
  meetingLangLbl: 'Ngôn ngữ cuộc họp',
  myLangLbl: 'Dịch sang',
  swapLangs: 'Đảo chiều',
  listen: 'Nghe',
  listenSub: 'Dịch giọng remote',
  speak: 'Nói',
  speakSub: 'Dịch giọng của bạn',
  twoway: 'Hai chiều',
  twowaySub: 'Cả hai cùng lúc',
  vizRemote: 'Tín hiệu Remote',
  vizMe: 'Tín hiệu của bạn',
  mic: 'Mic',
  vmic: 'Mic ảo',
  waitRemote: 'Đang chờ giọng nói từ cuộc họp…',
  waitMe: 'Nhấn giữ để nói…',
  idleHint: 'Nhấn Bắt đầu để mở phiên dịch',
  start: 'Bắt đầu',
  stop: 'Dừng',
  mute: 'Tắt tiếng',
  unmute: 'Bật tiếng',
  ptt: 'Nhấn giữ để nói',
  recording: 'Đang ghi…',
  loopWarn: 'Đầu ra không phải tai nghe — nguy cơ mic thu lại giọng TTS.',
  remoteSourceMissing: 'Chế độ Nói chỉ dịch giọng của bạn — không thu tiếng cuộc họp.',
  connecting: 'Đang kết nối…',

  setupSub: 'Chọn và kiểm tra thiết bị trước khi bắt đầu phiên.',
  micCard: 'Microphone',
  micRole: 'Nguồn giọng của bạn',
  sysCard: 'Âm thanh hệ thống',
  sysRole: 'Giọng từ cuộc họp',
  spkCard: 'Loa / Tai nghe',
  spkRole: 'Phát bản dịch cho bạn',
  vmicCard: 'Microphone ảo',
  vmicRole: 'Đưa giọng dịch vào Meet',
  deviceDefault: 'Thiết bị mặc định',
  noDevice: 'Không tìm thấy thiết bị',
  test: 'Kiểm tra',
  active: 'Hoạt động',
  ready: 'Sẵn sàng',
  connected: 'Đã kết nối',
  deferred: 'Chưa bật',
  sysHint:
    'Thu qua loopback của hệ điều hành, tự bật khi bắt đầu phiên ở chế độ Nghe hoặc Hai chiều. macOS cần cấp quyền Ghi màn hình cho ứng dụng.',
  sysCapturing: 'Đang thu',
  ducking: 'Tạm ngưng thu (đang phát bản dịch)',
  instanceT: 'Cấu hình thực thi (Instance)',
  instanceSub: 'Phần cứng phát hiện được từ ứng dụng.',
  detecting: 'Đang phát hiện phần cứng…',
  gpuLbl: 'GPU',
  cpuLbl: 'CPU',
  ramLbl: 'RAM',
  apiLbl: 'API',
  recommended: 'Khuyến nghị',
  notAvail: 'Không khả dụng',
  devAuto: 'Tự động',
  devAutoSub: 'Theo phần cứng',
  devCuda: 'NVIDIA CUDA',
  devMetal: 'Apple Metal',
  devVulkan: 'Vulkan (AMD/Intel)',
  devCpu: 'Chỉ CPU',
  devCpuSub: 'Tương thích nhất',
  cores: 'lõi',
  atLeast: 'ít nhất',
  computeReadOnly: 'AI service tự chọn backend khi nạp model — chưa đổi được từ giao diện.',
  computeFromService:
    'Thiết bị thật của từng khâu do AI service báo về khi nạp model — chưa đổi được từ giao diện.',
  sysStatus: 'Trạng thái hệ thống',
  models: 'Model',
  compute: 'Tính toán',
  vmicStatus: 'Mic ảo',
  tipTitle: 'Cấu hình Google Meet',
  tipBody:
    'Trong Meet, chọn micro là microphone ảo đã cấu hình và giữ loa là tai nghe vật lý để tránh vọng âm.',
  loopCheckT: 'Kiểm tra vòng lặp âm thanh',
  loopOk: 'An toàn — đầu ra là tai nghe',
  loopWarnSetup: 'Loa đang phát ra tiếng có thể lọt lại vào mic. Dùng tai nghe để tránh vọng âm.',
  loopUnknown: 'Chưa chọn thiết bị đầu ra — không xác định được nguy cơ vọng âm.',

  modelSub: 'Chọn preset hiệu năng cho pipeline chạy trên máy.',
  presetActive: 'ĐANG DÙNG',
  installed: 'Khâu pipeline đang chạy',
  onDisk: 'Model đã tải trên máy',
  noModelsOnDisk: 'Chưa có model nào trên đĩa — service sẽ tự tải khi nạp preset.',
  loadIdle: 'Chưa nạp',
  loadedLbl: 'Đã nạp',
  ramWarnHard:
    'Preset này cần ~{req} GB RAM nhưng máy báo {have} GB. Có thể tràn bộ nhớ hoặc chạy rất chậm.',
  ramWarnSoft: 'Preset này cần ~{req} GB RAM/VRAM. Kiểm tra máy đủ bộ nhớ trước khi nạp.',
  mbIdleT: 'Model chưa được nạp',
  mbIdleS: 'AI service nạp model khi khởi động hoặc khi đổi preset.',
  mbReadyT: 'AI service đã sẵn sàng',
  mbReadyS: 'Model của preset đang giữ trong bộ nhớ. Sẵn sàng phiên dịch.',
  mbDownT: 'Không kết nối được AI service',
  mbDownS: 'Chạy `make service` để khởi động dịch vụ cục bộ.',
  applyingPreset: 'Đang nạp preset…',
  presetFailed: 'Đổi preset thất bại',
  stageLbl: 'Khâu',
  adapterLbl: 'Adapter',
  customTitle: 'Cấu hình tự chọn',
  customSub: 'Chọn model riêng cho từng khâu — cần API model bên AI service.',
  browseTitle: 'Tìm & tải model từ Hugging Face',
  browseSub: 'Danh mục tham khảo theo docs/02 — tải về chưa nối với AI service.',
  browseDisabled: 'Tải model từ giao diện chưa hỗ trợ.',
  searchPh: 'Lọc danh mục (whisper, nllb, piper…)',
  dlBtn: 'Tải về',
  noCatalogResults: 'Không có model nào khớp từ khóa.',

  diagSub: 'Đo độ trễ và tài nguyên theo thời gian thực.',
  latencyBreak: 'Phân rã độ trễ (câu gần nhất)',
  benchTitle: 'Test độ trễ model',
  benchDesc: 'Chạy một câu mẫu qua cả pipeline để đo độ trễ thực tế.',
  benchRun: 'Chạy test',
  benchRunning: 'Đang đo…',
  benchAgain: 'Đo lại',
  benchIdle: 'Chưa đo lần nào. Nhấn "Chạy test" để đo trên máy này.',
  benchOn: 'Chiều dịch',
  benchTotal: 'Tổng đầu-cuối',
  benchFailed: 'Đo độ trễ thất bại',
  benchNote:
    'Mỗi khâu chạy với đầu vào cố định nên số đo không phụ thuộc chất lượng khâu trước. Đây là phép đo thời gian, không phải độ chính xác.',
  rtFactor: 'so với thời gian thực',
  serviceCpu: 'CPU service',
  serviceRam: 'RAM service',
  serviceThreads: 'luồng',
  systemRam: 'RAM máy',
  resourcesT: 'Phần cứng',
  audioT: 'Đường tín hiệu audio',
  sampleRate: 'Tần số lấy mẫu',
  frameSize: 'Kích thước khung',
  utterCount: 'Số câu đã dịch',
  wsLog: 'Nhật ký WebSocket',
  clear: 'Xóa',
  noMessages: '— chưa có message —',
  diagEmptyT: 'Chưa có dữ liệu chẩn đoán',
  diagEmptyS: 'Bắt đầu một phiên phiên dịch để xem độ trễ theo thời gian thực.',
  endToEnd: 'Tổng đầu-cuối',

  historySub: 'Mỗi cuộc họp được ghi lại riêng khi bạn nhấn Bắt đầu.',
  clearAll: 'Xóa tất cả',
  meetingsTitle: 'Cuộc họp',
  utter: 'câu',
  startToRec: 'Vào màn Phiên dịch và nhấn Bắt đầu để ghi lại một cuộc họp mới.',
  searchHistory: 'Tìm theo tên cuộc họp hoặc từ khóa…',
  noResultsT: 'Không tìm thấy kết quả',
  noResultsS: 'Thử từ khóa khác hoặc xóa bộ lọc.',
  emptyTranscript: 'Chưa có câu dịch nào — đang chờ ghi…',
  colTime: 'Thời gian',
  colSrc: 'Nguồn',
  colOriginal: 'Gốc',
  colTranslated: 'Bản dịch',
  colLatency: 'Độ trễ',
  renameTip: 'Đổi tên',
  deleteTip: 'Xóa',
  meetingPrefix: 'Cuộc họp',
  historyUnavailable: 'Không đọc được lịch sử — AI service chưa chạy?',
  rowFailed: 'Câu này chạy lỗi',

  dirTitle: 'Thư mục lưu model',
  dirDesc: 'Chọn nơi tải về và nạp model. Đặt sang ổ đĩa khác nếu ổ cục bộ sắp đầy.',
  dirBrowse: 'Chọn thư mục…',
  dirUsed: 'Đang dùng',
  dirPh: '/đường/dẫn/model',
  dirClear: 'Xóa toàn bộ model',
  dirApply: 'Áp dụng',
  dirNote:
    'Model đã tải không được chuyển sang thư mục mới; nếu chỗ mới trống thì lần nạp sau sẽ tải lại.',
  dirLocked: 'Biến môi trường LLVT_MODELS_DIR đang quyết định thư mục này.',
  dirConfirmClear:
    'Xóa toàn bộ model đã tải trong thư mục này? Lần bắt đầu phiên sau sẽ phải tải lại.',
  dirCleared: 'Đã xóa model, giải phóng',
  dirNothingToClear: 'Không có model nào để xóa.',

  privacyT: 'Quyền riêng tư',
  privacyDesc:
    'Lịch sử phiên (câu gốc, bản dịch, độ trễ) lưu trong một file SQLite trên máy. Không lưu file âm thanh, không gửi ra ngoài.',
  historyOn: 'Lưu lịch sử',
  historyOff: 'Không lưu',
  historyPath: 'Nơi lưu:',
  historyPathUnknown: 'Chưa đọc được cấu hình từ AI service.',
  historyOffNote: 'Tắt thì phiên mới không được ghi; dữ liệu cũ vẫn xem và xóa được ở màn Lịch sử.',

  settingsSub: 'Tùy chỉnh giao diện và ngôn ngữ của ứng dụng.',
  appearance: 'Giao diện',
  themeDesc: 'Chọn chủ đề sáng, tối hoặc theo hệ thống.',
  uiLang: 'Ngôn ngữ giao diện',
  langDesc: 'Ngôn ngữ hiển thị của toàn bộ nhãn trong ứng dụng.',
  tSystem: 'Hệ thống',
  tLight: 'Sáng',
  tDark: 'Tối',
  tSystemSub: 'Theo máy',
  tLightSub: 'Luôn sáng',
  tDarkSub: 'Luôn tối',
  hfTitle: 'Hugging Face Token',
  hfDesc: 'Lưu token để tải model cần quyền truy cập (gated).',
  hfPh: 'hf_xxxxxxxxxxxxxxxxxxxx',
  hfUnused: 'Token chỉ được lưu cục bộ; chức năng tải model chưa nối với AI service.',
  glossTitle: 'Thuật ngữ tùy chỉnh (Glossary)',
  glossDesc: 'Thay thế tên riêng và thuật ngữ trong bản dịch hiển thị.',
  glossSrcPh: 'Từ gốc / thuật ngữ',
  glossDstPh: 'Dịch thành',
  glossAdd: 'Thêm',
  glossEmpty: 'Chưa có thuật ngữ nào.',
  glossCount: 'thuật ngữ',

  aboutSub: 'Thông tin phiên bản, công nghệ và giấy phép.',
  aboutTagline: 'Dịch giọng nói trực tiếp, chạy hoàn toàn trên máy của bạn.',
  aboutStackT: 'Công nghệ lõi',
  aboutPrivacyT: 'Quyền riêng tư',
  aboutPrivacyB:
    'Toàn bộ âm thanh và bản dịch được xử lý cục bộ. Không có dữ liệu nào rời khỏi máy — không gửi lên cloud.',
  aboutLinksT: 'Liên kết',
  aboutRepo: 'Kho mã nguồn',
  aboutDocs: 'Tài liệu',
  aboutLicense: 'Giấy phép',
  aboutInspired: 'Lấy cảm hứng từ TranscriptionSuite',
  aboutVersion: 'Phiên bản',
  aboutBuild: 'AI service',
  aboutPlatform: 'Nền tảng',

  importSub: 'Chuyển tệp âm thanh thành văn bản (transcription).',
  importDisabledT: 'Nhập tệp chưa khả dụng',
  importDisabledS:
    'Cần endpoint transcribe theo lô bên AI service. Hiện tại chỉ có pipeline realtime qua WebSocket.',
  dropSub: 'Hỗ trợ MP3, WAV, M4A, FLAC, OGG, WebM, Opus — nhiều tệp cùng lúc',

  stRecognizing: 'Nhận diện',
  stTranslating: 'Đang dịch',
  stSpeaking: 'Đang phát',
  stCompleted: 'Hoàn tất',
  stFailed: 'Lỗi',
  stWaiting: 'Chờ xác nhận'
}

const en: Dict = {
  appName: 'Local Live Voice Translator',
  offline: 'Offline',
  offlineReady: 'Offline Ready',
  noCloud: 'No cloud used',
  serviceDown: 'AI service not connected',
  serviceDownSub: 'Run `make service` and try again.',
  notSupported: 'Not supported',
  notSupportedYet: 'This needs an AI service endpoint that does not exist in this build yet.',
  recoverT: 'Recover unsaved session?',
  recoverS: 'The app closed while recording. This meeting is still available:',
  recoverBtn: 'Review',
  recoverDismiss: 'Dismiss',

  session: 'Session',
  setup: 'Audio Setup',
  modelMgr: 'Model Manager',
  diagnostics: 'Diagnostics',
  history: 'History',
  settings: 'Settings',
  about: 'About',
  importFiles: 'Import Files',

  layout: 'Layout',
  vSplit: 'Split',
  vTimeline: 'Timeline',
  vFocus: 'Focus',
  meetingLangLbl: 'Meeting language',
  myLangLbl: 'Translate to',
  swapLangs: 'Swap',
  listen: 'Listen',
  listenSub: 'Translate remote',
  speak: 'Speak',
  speakSub: 'Translate you',
  twoway: 'Two-way',
  twowaySub: 'Both at once',
  vizRemote: 'Remote signal',
  vizMe: 'Your signal',
  mic: 'Mic',
  vmic: 'Virtual Mic',
  waitRemote: 'Waiting for meeting audio…',
  waitMe: 'Hold to talk…',
  idleHint: 'Press Start to open a session',
  start: 'Start',
  stop: 'Stop',
  mute: 'Mute',
  unmute: 'Unmute',
  ptt: 'Push to Talk',
  recording: 'Recording…',
  loopWarn: 'Output is not headphones — the mic may pick the TTS voice back up.',
  remoteSourceMissing: 'Speak mode only translates your voice — meeting audio is not captured.',
  connecting: 'Connecting…',

  setupSub: 'Select and test your devices before starting a session.',
  micCard: 'Microphone',
  micRole: 'Your voice input',
  sysCard: 'System audio',
  sysRole: 'Voice from the meeting',
  spkCard: 'Speaker / Headphones',
  spkRole: 'Plays translation to you',
  vmicCard: 'Virtual microphone',
  vmicRole: 'Sends translated voice to Meet',
  deviceDefault: 'System default',
  noDevice: 'No device found',
  test: 'Test',
  active: 'Active',
  ready: 'Ready',
  connected: 'Connected',
  deferred: 'Off',
  sysHint:
    'Captured through the OS loopback; starts automatically in Listen or Two-way mode. On macOS the app needs Screen Recording permission.',
  sysCapturing: 'Capturing',
  ducking: 'Capture paused (playing translation)',
  instanceT: 'Instance settings',
  instanceSub: 'Hardware detected from the app.',
  detecting: 'Detecting hardware…',
  gpuLbl: 'GPU',
  cpuLbl: 'CPU',
  ramLbl: 'RAM',
  apiLbl: 'API',
  recommended: 'Recommended',
  notAvail: 'Not available',
  devAuto: 'Automatic',
  devAutoSub: 'Follows hardware',
  devCuda: 'NVIDIA CUDA',
  devMetal: 'Apple Metal',
  devVulkan: 'Vulkan (AMD/Intel)',
  devCpu: 'CPU only',
  devCpuSub: 'Most compatible',
  cores: 'cores',
  atLeast: 'at least',
  computeReadOnly:
    'The AI service picks the backend when loading models — not switchable from the UI.',
  computeFromService:
    'Per-stage device reported by the AI service after loading models — not switchable from the UI.',
  sysStatus: 'System status',
  models: 'Models',
  compute: 'Compute',
  vmicStatus: 'Virtual mic',
  tipTitle: 'Google Meet setup',
  tipBody:
    'In Meet, set the microphone to your virtual microphone and keep output on physical headphones to avoid echo.',
  loopCheckT: 'Audio-loop check',
  loopOk: 'Safe — output is headphones',
  loopWarnSetup: 'Speaker output may leak back into the mic. Use headphones to avoid echo.',
  loopUnknown: 'No output device selected — echo risk unknown.',

  modelSub: 'Pick the performance preset the local pipeline runs with.',
  presetActive: 'ACTIVE',
  installed: 'Active pipeline stages',
  onDisk: 'Models on disk',
  noModelsOnDisk: 'No model files yet — the service downloads them when a preset loads.',
  loadIdle: 'Not loaded',
  loadedLbl: 'Loaded',
  ramWarnHard:
    'This preset needs ~{req} GB RAM but the machine reports {have} GB. It may run out of memory or be very slow.',
  ramWarnSoft: 'This preset needs ~{req} GB RAM/VRAM. Make sure the machine has enough.',
  mbIdleT: 'Models not loaded',
  mbIdleS: 'The AI service loads models at startup or when the preset changes.',
  mbReadyT: 'AI service ready',
  mbReadyS: 'The preset models are held in memory. Ready to translate.',
  mbDownT: 'Cannot reach the AI service',
  mbDownS: 'Run `make service` to start the local service.',
  applyingPreset: 'Loading preset…',
  presetFailed: 'Changing preset failed',
  stageLbl: 'Stage',
  adapterLbl: 'Adapter',
  customTitle: 'Custom configuration',
  customSub: 'Pick a model per stage — needs a model API on the AI service.',
  browseTitle: 'Search & download from Hugging Face',
  browseSub: 'Reference catalog from docs/02 — downloading is not wired to the AI service.',
  browseDisabled: 'Downloading models from the UI is not supported.',
  searchPh: 'Filter catalog (whisper, nllb, piper…)',
  dlBtn: 'Download',
  noCatalogResults: 'No model matches that keyword.',

  diagSub: 'Real-time latency and resource monitoring.',
  latencyBreak: 'Latency breakdown (last utterance)',
  benchTitle: 'Model latency test',
  benchDesc: 'Run one sample utterance through the full pipeline to measure real latency.',
  benchRun: 'Run test',
  benchRunning: 'Measuring…',
  benchAgain: 'Measure again',
  benchIdle: 'No measurement yet. Press "Run test" to measure on this machine.',
  benchOn: 'Direction',
  benchTotal: 'End-to-end total',
  benchFailed: 'Measurement failed',
  benchNote:
    'Each stage runs on fixed input, so a stage timing never depends on the previous one. This measures time, not accuracy.',
  rtFactor: 'vs realtime',
  serviceCpu: 'Service CPU',
  serviceRam: 'Service RAM',
  serviceThreads: 'threads',
  systemRam: 'System RAM',
  resourcesT: 'Hardware',
  audioT: 'Audio path',
  sampleRate: 'Sample rate',
  frameSize: 'Frame size',
  utterCount: 'Translated lines',
  wsLog: 'WebSocket log',
  clear: 'Clear',
  noMessages: '— no messages yet —',
  diagEmptyT: 'No diagnostics data yet',
  diagEmptyS: 'Start a translation session to see real-time latency.',
  endToEnd: 'End-to-end total',

  historySub: 'Each meeting is recorded separately when you press Start.',
  clearAll: 'Clear all',
  meetingsTitle: 'Meetings',
  utter: 'lines',
  startToRec: 'Go to the Session screen and press Start to record a new meeting.',
  searchHistory: 'Search by meeting name or keyword…',
  noResultsT: 'No results found',
  noResultsS: 'Try a different keyword or clear the filter.',
  emptyTranscript: 'No translated lines yet — recording…',
  colTime: 'Time',
  colSrc: 'Source',
  colOriginal: 'Original',
  colTranslated: 'Translated',
  colLatency: 'Latency',
  renameTip: 'Rename',
  deleteTip: 'Delete',
  meetingPrefix: 'Meeting',
  historyUnavailable: 'Cannot read history — is the AI service running?',
  rowFailed: 'This line failed',

  dirTitle: 'Model storage folder',
  dirDesc:
    'Choose where models are downloaded and loaded from. Point to another drive if your local disk is full.',
  dirBrowse: 'Choose folder…',
  dirUsed: 'In use',
  dirPh: '/path/to/models',
  dirClear: 'Delete all models',
  dirApply: 'Apply',
  dirNote:
    'Downloaded models are not moved to the new folder; if it is empty they will be downloaded again on the next load.',
  dirLocked: 'The LLVT_MODELS_DIR environment variable is controlling this folder.',
  dirConfirmClear:
    'Delete every downloaded model in this folder? They will be downloaded again the next time a session starts.',
  dirCleared: 'Models deleted, freed',
  dirNothingToClear: 'No models to delete.',

  privacyT: 'Privacy',
  privacyDesc:
    'Session history (original text, translation, latency) is stored in a SQLite file on this machine. No audio is saved and nothing leaves the device.',
  historyOn: 'Save history',
  historyOff: "Don't save",
  historyPath: 'Stored at:',
  historyPathUnknown: 'Could not read the configuration from the AI service.',
  historyOffNote:
    'When off, new sessions are not recorded; existing data stays readable and deletable on the History screen.',

  settingsSub: 'Customize the appearance and language of the app.',
  appearance: 'Appearance',
  themeDesc: 'Choose a light, dark, or system-based theme.',
  uiLang: 'Interface language',
  langDesc: 'Display language for every label in the app.',
  tSystem: 'System',
  tLight: 'Light',
  tDark: 'Dark',
  tSystemSub: 'Match OS',
  tLightSub: 'Always light',
  tDarkSub: 'Always dark',
  hfTitle: 'Hugging Face Token',
  hfDesc: 'Store a token for gated / private model downloads.',
  hfPh: 'hf_xxxxxxxxxxxxxxxxxxxx',
  hfUnused: 'The token is stored locally only; model download is not wired to the AI service.',
  glossTitle: 'Custom glossary',
  glossDesc: 'Replace names and industry terms in the translation shown.',
  glossSrcPh: 'Source term',
  glossDstPh: 'Translate as',
  glossAdd: 'Add',
  glossEmpty: 'No terms yet.',
  glossCount: 'terms',

  aboutSub: 'Version, technology and license information.',
  aboutTagline: 'Live voice translation, running entirely on your machine.',
  aboutStackT: 'Core technology',
  aboutPrivacyT: 'Privacy',
  aboutPrivacyB:
    'All audio and translations are processed locally. No data ever leaves your machine — nothing is sent to the cloud.',
  aboutLinksT: 'Links',
  aboutRepo: 'Source repository',
  aboutDocs: 'Documentation',
  aboutLicense: 'License',
  aboutInspired: 'Inspired by TranscriptionSuite',
  aboutVersion: 'Version',
  aboutBuild: 'AI service',
  aboutPlatform: 'Platform',

  importSub: 'Turn audio files into text transcriptions.',
  importDisabledT: 'Import is not available',
  importDisabledS:
    'It needs a batch transcribe endpoint on the AI service. Only the realtime WebSocket pipeline exists today.',
  dropSub: 'Supports MP3, WAV, M4A, FLAC, OGG, WebM, Opus — multiple files OK',

  stRecognizing: 'Recognizing',
  stTranslating: 'Translating',
  stSpeaking: 'Speaking',
  stCompleted: 'Completed',
  stFailed: 'Failed',
  stWaiting: 'Waiting'
}

const DICTS: Record<UiLanguage, Dict> = { vi, en }

export function dict(lang: UiLanguage): Dict {
  return DICTS[lang]
}

const LANGUAGE_NAMES: Record<UiLanguage, Record<Language, string>> = {
  vi: { vi: 'Tiếng Việt', en: 'Tiếng Anh', ja: 'Tiếng Nhật', zh: 'Tiếng Trung' },
  en: { vi: 'Vietnamese', en: 'English', ja: 'Japanese', zh: 'Chinese' }
}

export function languageName(lang: UiLanguage, code: Language): string {
  return LANGUAGE_NAMES[lang][code]
}

export function languageShort(code: Language): string {
  return code.toUpperCase()
}

export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in values ? String(values[key]) : m
  )
}
