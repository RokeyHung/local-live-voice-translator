// Từ điển nhãn giao diện (vi/en). Ngôn ngữ giao diện độc lập với ngôn ngữ dịch:
// đổi ở màn Cài đặt, không ảnh hưởng cặp ngôn ngữ của phiên.

import type { Language, UiLanguage } from '../domain/enums'

export interface Dict {
  // chung
  appName: string
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
  evaluate: string
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
  devInUse: string
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
  chooseProfile: string
  presetActive: string
  presetCustom: string
  installed: string
  onDisk: string
  clearModelsBtn: string
  cancelLoad: string
  dldOk: string
  noModelsOnDisk: string
  loadIdle: string
  loadedLbl: string
  ramWarnHard: string
  ramWarnSoft: string
  mbIdleS: string
  mbDownT: string
  mbDownS: string
  mbLoadT: string
  mbLoadS: string
  startModels: string
  reloadModels: string
  unloadModels: string
  loadFailed: string
  // Bảng tiến trình nạp model.
  lpTitle: string
  lpWaiting: string
  lpDownloading: string
  lpLoading: string
  lpDone: string
  lpFailed: string
  lpCancelled: string
  modelsIdleBadge: string
  mbIdleHint: string
  presetFailed: string
  stageLbl: string
  adapterLbl: string
  customTitle: string
  customAsrAdapter: string
  customAsrModel: string
  customMtModel: string
  customApply: string
  customNote: string
  dlWorking: string
  dlFromHfHint: string
  delOneTip: string
  confirmDeleteOne: string
  customSub: string
  browseTitle: string
  browseSub: string
  browseDisabled: string
  catalogWrongPlatform: string
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
  // nhật ký ứng dụng
  logs: string
  logsSub: string
  logAll: string
  logInfo: string
  logWarn: string
  logError: string
  logClear: string
  logExport: string
  logEmpty: string
  // nội dung các dòng nhật ký
  logAppStarted: string
  logUnhandled: string
  logServiceUp: string
  logServiceDown: string
  logWsOpen: string
  logWsClosed: string
  logSessionStart: string
  logSessionStop: string
  logModelsLoading: string
  logModelsReady: string
  logModelsFailed: string
  logModelsUnloaded: string
  logPresetChanged: string
  logModelsDeleted: string
  logModelDownloaded: string
  logModelDeleted: string
  logModelsDirChanged: string
  logHfTokenSaved: string
  logHfTokenCleared: string
  logImportStart: string
  logImportDone: string
  logImportCancelled: string
  logImportFailed: string
  logBenchDone: string
  logBenchFailed: string
  logEvalStart: string
  logEvalDone: string
  logEvalFailed: string
  // đánh giá
  evalSub: string
  evalBundledSet: string
  evalCustomSet: string
  evalSetSummary: string
  evalPickFile: string
  evalUseBundled: string
  evalQuick: string
  evalRun: string
  evalRunning: string
  evalFailed: string
  evalBadFile: string
  evalEmptyFile: string
  evalSyntheticT: string
  evalSyntheticB: string
  evalSyntheticBadge: string
  evalCancelledNote: string
  evalScriptNote: string
  evalLowerBetter: string
  evalHigherBetter: string
  evalAsrP50: string
  evalAsrP90: string
  evalMtP90: string
  evalRtfP90: string
  evalRtfOk: string
  evalRtfSlow: string
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
  // thư mục dữ liệu ứng dụng
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
  // phân rã dung lượng đĩa
  stModels: string
  stHistory: string
  stCache: string
  cleanBtn: string
  emptyDir: string
  cleanHint: string
  cleanNoLogs: string
  confirmClearHistory: string
  logCacheCleared: string
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
  reviewTitle: string
  reviewSend: string
  reviewDiscard: string
  reviewAutoIn: string
  reviewHint: string
  reviewSectionTitle: string
  reviewSectionDesc: string
  reviewOn: string
  reviewOff: string
  reviewCountdownLbl: string
  reviewCountdownOff: string
  reviewMidSession: string
  hfTitle: string
  hfDesc: string
  hfPh: string
  hfSave: string
  hfClear: string
  hfVerify: string
  hfVerifying: string
  hfSaved: string
  hfNone: string
  hfFromEnv: string
  hfInherited: string
  hfLocked: string
  hfOkUser: string
  hfBadToken: string
  hfWhy: string
  hfReloadHint: string
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
  dropTitle: string
  dropSub: string
  browseFiles: string
  queueTitle: string
  queueDone: string
  queuePendingN: string
  queuePending: string
  queueDecoding: string
  phaseExtract: string
  videoBadge: string
  queueProcessing: string
  queueOk: string
  queueError: string
  queueCancelled: string
  cancelBtn: string
  cancelling: string
  transcriptFmt: string
  copyBtn: string
  copied: string
  downloadBtn: string
  clearDone: string
  retryTip: string
  removeTip: string
  durationLbl: string
  diarizeLbl: string
  diarizeOff: string
  diarizeHint: string
  impFileLang: string
  impTargetLang: string
  impNoTranslate: string
  impSave: string
  impSaved: string
  impHistoryOff: string
  impDecodeFailed: string
  impBadContainer: string
  impTooLarge: string
  impNoSpeech: string
  impSegments: string
  impLoadHint: string
  impBusySession: string
  // tách người nói (diarization) — chỉ có ở màn Nhập tệp
  impDiarizing: string
  impSpeakers: string
  speakerN: string
  speakerUnknown: string
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
  evaluate: 'Đánh giá',

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
  devInUse: 'Đang dùng',
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
  chooseProfile: 'Chọn cấu hình hiệu năng',
  presetActive: 'ĐANG DÙNG',
  presetCustom: 'Tự chọn',
  installed: 'Khâu pipeline đang chạy',
  onDisk: 'Model đã cài',
  clearModelsBtn: 'Xóa tất cả',
  cancelLoad: 'Hủy nạp',
  dldOk: 'Đã tải',
  noModelsOnDisk: 'Chưa có model nào trên đĩa — service sẽ tự tải khi nạp preset.',
  loadIdle: 'Chưa nạp',
  loadedLbl: 'Đã nạp',
  ramWarnHard:
    'Preset này cần ~{req} GB RAM nhưng máy báo {have} GB. Có thể tràn bộ nhớ hoặc chạy rất chậm.',
  ramWarnSoft: 'Preset này cần ~{req} GB RAM/VRAM. Kiểm tra máy đủ bộ nhớ trước khi nạp.',
  mbIdleS: 'Nhấn "Khởi động model" hoặc bấm Bắt đầu ở màn Phiên dịch để nạp vào bộ nhớ.',
  mbDownT: 'Không kết nối được AI service',
  mbDownS: 'Chạy `make service` để khởi động dịch vụ cục bộ.',
  mbLoadT: 'Đang nạp model…',
  mbLoadS: 'Đưa trọng số vào RAM. Lần đầu còn phải tải model nên có thể lâu.',
  startModels: 'Khởi động model',
  reloadModels: 'Nạp lại',
  unloadModels: 'Giải phóng',
  loadFailed: 'Nạp model thất bại',
  lpTitle: 'Tiến trình nạp model',
  lpWaiting: 'chờ',
  lpDownloading: 'đang tải…',
  lpLoading: 'đang nạp…',
  lpDone: 'xong',
  lpFailed: 'lỗi',
  lpCancelled: 'đã dừng',
  modelsIdleBadge: 'Chưa nạp model',
  mbIdleHint: 'Bấm Bắt đầu để nạp',
  presetFailed: 'Đổi preset thất bại',
  stageLbl: 'Khâu',
  adapterLbl: 'Adapter',
  customTitle: 'Cấu hình tự chọn',
  customSub: 'Chọn model riêng cho từng khâu.',
  customAsrAdapter: 'Runtime ASR',
  customAsrModel: 'Model ASR',
  customMtModel: 'Model dịch',
  customApply: 'Lưu lựa chọn',
  customNote: 'Lưu xong bấm "Tự chọn" ở trên để chạy bộ này. Khâu VAD và TTS vẫn theo Balanced.',
  dlWorking: 'Đang tải…',
  dlFromHfHint:
    'Không có trong danh mục. Tải thẳng từ HuggingFace — chọn runtime sẽ chạy model này.',
  delOneTip: 'Xoá model này',
  confirmDeleteOne: 'Xoá model này khỏi đĩa? Lần nạp sau sẽ phải tải lại.',
  browseTitle: 'Tìm & tải model từ Hugging Face',
  browseSub: 'Danh mục tham khảo theo docs/02 — tải về chưa nối với AI service.',
  browseDisabled: 'Tải model từ giao diện chưa hỗ trợ.',
  catalogWrongPlatform: 'Model này không chạy trên hệ điều hành hiện tại.',
  searchPh: 'Lọc danh mục, hoặc dán đường dẫn HuggingFace…',
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

  logs: 'Nhật ký',
  logsSub: 'Theo dõi sự kiện và lỗi của ứng dụng để gỡ rối.',
  logAll: 'Tất cả',
  logInfo: 'Thông tin',
  logWarn: 'Cảnh báo',
  logError: 'Lỗi',
  logClear: 'Xóa',
  logExport: 'Xuất log',
  logEmpty: 'Chưa có nhật ký nào.',

  logAppStarted: 'Ứng dụng khởi động',
  logUnhandled: 'Lỗi không bắt được: {msg}',
  logServiceUp: 'Kết nối được AI service',
  logServiceDown: 'Mất kết nối AI service',
  logWsOpen: 'Kênh phiên đã mở (WebSocket)',
  logWsClosed: 'Kênh phiên đã đóng',
  logSessionStart: 'Bắt đầu phiên · {title}',
  logSessionStop: 'Đã dừng phiên',
  logModelsLoading: 'Bắt đầu nạp model',
  logModelsReady: 'Model đã sẵn sàng trong bộ nhớ',
  logModelsFailed: 'Nạp model thất bại: {msg}',
  logModelsUnloaded: 'Đã giải phóng model khỏi bộ nhớ',
  logPresetChanged: 'Đổi preset sang {preset}',
  logModelsDeleted: 'Đã xóa model trên đĩa, giải phóng {size}',
  logModelDownloaded: 'Đã tải model {name}',
  logModelDeleted: 'Đã xoá một model, giải phóng {size}',
  logModelsDirChanged: 'Đổi thư mục lưu model sang {dir}',
  logHfTokenSaved: 'Đã lưu access token HuggingFace',
  logHfTokenCleared: 'Đã gỡ access token HuggingFace',
  logImportStart: 'Bắt đầu xử lý tệp {name}',
  logImportDone: 'Xong {name} · {count} đoạn',
  logImportCancelled: 'Đã huỷ tệp đang xử lý',
  logImportFailed: 'Lỗi khi xử lý {name}: {msg}',
  logBenchDone: 'Đo độ trễ xong · tổng {total} ms',
  logBenchFailed: 'Đo độ trễ thất bại: {msg}',
  logEvalStart: 'Bắt đầu đánh giá {n} câu',
  logEvalDone: 'Đánh giá xong {n} câu — lỗi {err}, chrF {chrf}',
  logEvalFailed: 'Đánh giá thất bại: {msg}',

  evalSub: 'Chạy bộ câu mẫu qua hệ thống và tự chấm điểm.',
  evalBundledSet: 'Bộ câu mẫu đi kèm',
  evalCustomSet: 'Bộ câu của bạn',
  evalSetSummary: '{n} câu · {recorded} có bản ghi thật · {synthetic} dùng giọng tổng hợp',
  evalPickFile: 'Nạp file JSON',
  evalUseBundled: 'Dùng bộ mẫu',
  evalQuick: 'Chạy thử 3 câu',
  evalRun: 'Chạy đánh giá',
  evalRunning: 'Đang chấm {id}…',
  evalFailed: 'Chạy đánh giá thất bại',
  evalBadFile: 'Không đọc được file',
  evalEmptyFile: 'File không có câu nào.',
  evalSyntheticT: 'Có câu chạy bằng giọng tổng hợp',
  evalSyntheticB:
    'Câu không có bản ghi thì máy tự đọc rồi tự nghe lại. Giọng tổng hợp sạch và đều nên số sẽ LẠC QUAN hơn thực tế — muốn số dùng được cho báo cáo thì thu âm giọng người và điền đường dẫn vào trường `audio`.',
  evalSyntheticBadge: 'giọng máy',
  evalCancelledNote: 'Đã dừng giữa chừng — bảng dưới chỉ gồm những câu đã chấm xong.',
  evalScriptNote:
    'Số ở đây để thử nhanh và so các cấu hình với nhau. Bảng đưa vào báo cáo lấy từ `make eval-asr` / `make eval-mt` (dùng jiwer + spBLEU nên so được với số công bố của NLLB-200).',
  evalLowerBetter: 'càng thấp càng tốt',
  evalHigherBetter: 'càng cao càng tốt',
  evalAsrP50: 'ASR p50',
  evalAsrP90: 'ASR p90',
  evalMtP90: 'Dịch p90',
  evalRtfP90: 'RTF p90',
  evalRtfOk: 'nhanh hơn thời gian thực',
  evalRtfSlow: 'chậm hơn thời gian thực',
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

  dirTitle: 'Thư mục dữ liệu ứng dụng',
  dirDesc:
    'Đường dẫn bên dưới là nơi tải về và nạp model — đặt sang ổ đĩa khác nếu ổ cục bộ sắp đầy. Danh sách phía dưới là toàn bộ những gì ứng dụng ghi ra đĩa.',
  dirBrowse: 'Chọn thư mục…',
  dirUsed: 'Tổng',
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
  stModels: 'Model',
  stHistory: 'Lịch sử',
  stCache: 'Cache',
  cleanBtn: 'Dọn',
  emptyDir: 'trống',
  cleanHint: 'Cache dọn lúc nào cũng được; xóa model và lịch sử là mất dữ liệu.',
  cleanNoLogs:
    'Không có mục Log vì ứng dụng không ghi file log nào: AI service in ra stdout, còn nhật ký của giao diện chỉ nằm trong bộ nhớ.',
  confirmClearHistory: 'Xóa toàn bộ lịch sử phiên dịch? Không khôi phục lại được.',
  logCacheCleared: 'Đã dọn cache của ứng dụng',

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
  reviewTitle: 'Duyệt trước khi gửi',
  reviewSend: 'Gửi',
  reviewDiscard: 'Bỏ',
  reviewAutoIn: 'tự gửi sau',
  reviewHint: 'Enter để gửi · Esc để bỏ',
  reviewSectionTitle: 'Duyệt trước khi gửi',
  reviewSectionDesc:
    'Dừng lại cho bạn sửa bản dịch trước khi đọc vào cuộc họp. Chính xác hơn, đổi lại mỗi câu phải chờ bạn bấm.',
  reviewOn: 'Bật',
  reviewOff: 'Tắt',
  reviewCountdownLbl: 'Tự gửi sau',
  reviewCountdownOff: 'Không tự gửi',
  reviewMidSession: 'Đổi lúc đang có phiên chạy thì phải bắt đầu lại phiên mới có tác dụng.',
  hfTitle: 'Hugging Face Token',
  hfDesc:
    'Token để tải model cần quyền truy cập (gated). AI service giữ, không nằm trong trình duyệt.',
  hfPh: 'hf_xxxxxxxxxxxxxxxxxxxx',
  hfSave: 'Lưu token',
  hfClear: 'Gỡ token',
  hfVerify: 'Kiểm tra',
  hfVerifying: 'Đang hỏi huggingface.co…',
  hfSaved: 'Đã lưu token {hint} — AI service giữ, không nằm trong trình duyệt.',
  hfNone: 'Chưa có token. Chỉ cần khi tải model gated (pyannote cho phần tách người nói).',
  hfFromEnv: 'Đang dùng token từ biến môi trường LLVT_HF_TOKEN ({hint}).',
  hfInherited: 'Đang dùng biến HF_TOKEN có sẵn trong môi trường ({hint}).',
  hfLocked: 'LLVT_HF_TOKEN đang quyết định — bỏ biến đó đi nếu muốn đổi trong app.',
  hfOkUser: 'Token hợp lệ — tài khoản {user}.',
  hfBadToken: 'Token không dùng được: {error}',
  hfWhy:
    'Token chỉ cần cho LẦN TẢI ĐẦU của model gated; tải xong service chạy offline như thường. Đây là lần duy nhất ứng dụng chủ động gọi ra Internet ngoài lúc tải model.',
  hfReloadHint: 'Vừa thêm token để sửa một khâu tải hỏng? Bấm "Nạp lại" ở màn Quản lý model.',
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

  importSub: 'Chuyển tệp audio hoặc video thành văn bản.',
  dropTitle: 'Kéo & Thả tệp Audio / Video',
  dropSub:
    'Hỗ trợ MP3, WAV, M4A, FLAC, OGG, WebM, Opus · và MP4, MOV, MKV, 3GP (tự tách audio) — nhiều tệp cùng lúc',
  browseFiles: 'Chọn tệp',
  queueTitle: 'Hàng đợi xử lý',
  queueDone: 'xong',
  queuePendingN: 'chờ',
  queuePending: 'Trong hàng đợi',
  queueDecoding: 'Đang giải mã…',
  phaseExtract: 'Đang tách audio',
  videoBadge: 'VIDEO',
  queueProcessing: 'Đang xử lý…',
  queueOk: 'Hoàn tất',
  queueError: 'Lỗi',
  queueCancelled: 'Đã huỷ',
  cancelBtn: 'Huỷ',
  cancelling: 'Đang dừng…',
  transcriptFmt: 'Định dạng',
  copyBtn: 'Sao chép',
  copied: 'Đã chép',
  downloadBtn: 'Tải về',
  clearDone: 'Xóa mục xong',
  retryTip: 'Chạy lại',
  removeTip: 'Bỏ khỏi hàng đợi',
  durationLbl: 'Thời lượng',
  diarizeLbl: 'Phân biệt người nói',
  diarizeOff:
    'Service chưa bật tách người nói. Cài `uv sync --extra diarization` rồi đặt LLVT_DIARIZATION_ENABLED=true.',
  diarizeHint:
    'Gắn nhãn người nói cho từng đoạn. Tốn thêm một lượt quét cả tệp trước khi nhận dạng chữ.',
  impFileLang: 'Ngôn ngữ trong tệp',
  impTargetLang: 'Dịch sang',
  impNoTranslate: 'Không dịch',
  impSave: 'Lưu vào lịch sử',
  impSaved: 'đã lưu vào Lịch sử',
  impHistoryOff: 'Lưu lịch sử đang tắt ở màn Cài đặt.',
  impDecodeFailed:
    'Không lấy được tiếng từ tệp — tệp có thể không có track âm thanh, hoặc bị hỏng.',
  impBadContainer:
    'Định dạng container này máy không đọc được (AVI, WMV, FLV, MPEG-TS). Hãy chuyển sang MP4 hoặc MKV rồi thử lại.',
  impTooLarge: 'Tệp lớn hơn 2 GB — hãy cắt ngắn hoặc nén lại trước khi nhập.',
  impNoSpeech: 'Không tìm thấy giọng nói nào trong tệp.',
  impSegments: 'đoạn',
  impLoadHint: 'Model được nạp trước khi chạy tệp đầu tiên; lần đầu có thể mất vài phút.',
  impBusySession:
    'Đang có phiên dịch chạy — dừng phiên trước khi nhập tệp, vì cả hai dùng chung model.',
  impDiarizing: 'Đang tách người nói…',
  impSpeakers: 'người nói',
  speakerN: 'Người nói {n}',
  speakerUnknown: 'Không rõ người nói',

  stRecognizing: 'Nhận diện',
  stTranslating: 'Đang dịch',
  stSpeaking: 'Đang phát',
  stCompleted: 'Hoàn tất',
  stFailed: 'Lỗi',
  stWaiting: 'Chờ xác nhận'
}

const en: Dict = {
  appName: 'Local Live Voice Translator',
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
  evaluate: 'Evaluation',

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
  devInUse: 'In use',
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
  chooseProfile: 'Performance profile',
  presetActive: 'ACTIVE',
  presetCustom: 'Custom',
  installed: 'Active pipeline stages',
  onDisk: 'Installed models',
  clearModelsBtn: 'Delete all',
  cancelLoad: 'Cancel load',
  dldOk: 'Downloaded',
  noModelsOnDisk: 'No model files yet — the service downloads them when a preset loads.',
  loadIdle: 'Not loaded',
  loadedLbl: 'Loaded',
  ramWarnHard:
    'This preset needs ~{req} GB RAM but the machine reports {have} GB. It may run out of memory or be very slow.',
  ramWarnSoft: 'This preset needs ~{req} GB RAM/VRAM. Make sure the machine has enough.',
  mbIdleS: 'Press "Start models", or press Start on the Session screen, to load them into memory.',
  mbDownT: 'Cannot reach the AI service',
  mbDownS: 'Run `make service` to start the local service.',
  mbLoadT: 'Loading models…',
  mbLoadS: 'Bringing weights into RAM. The first run also downloads them, so it can take a while.',
  startModels: 'Start models',
  reloadModels: 'Reload',
  unloadModels: 'Free memory',
  loadFailed: 'Loading models failed',
  lpTitle: 'Model loading progress',
  lpWaiting: 'waiting',
  lpDownloading: 'downloading…',
  lpLoading: 'loading…',
  lpDone: 'done',
  lpFailed: 'failed',
  lpCancelled: 'stopped',
  modelsIdleBadge: 'Models not loaded',
  mbIdleHint: 'Press Start to load',
  presetFailed: 'Changing preset failed',
  stageLbl: 'Stage',
  adapterLbl: 'Adapter',
  customTitle: 'Custom configuration',
  customSub: 'Pick a model per stage.',
  customAsrAdapter: 'ASR runtime',
  customAsrModel: 'ASR model',
  customMtModel: 'Translation model',
  customApply: 'Save choices',
  customNote: 'After saving, hit "Custom" above to run it. VAD and TTS still follow Balanced.',
  dlWorking: 'Downloading…',
  dlFromHfHint:
    'Not in the catalogue. Download straight from HuggingFace — pick the runtime that will run it.',
  delOneTip: 'Remove this model',
  confirmDeleteOne: 'Remove this model from disk? The next load will re-download it.',
  browseTitle: 'Search & download from Hugging Face',
  browseSub: 'Reference catalog from docs/02 — downloading is not wired to the AI service.',
  browseDisabled: 'Downloading models from the UI is not supported.',
  catalogWrongPlatform: 'This model does not run on the current operating system.',
  searchPh: 'Filter the catalogue, or paste a HuggingFace path…',
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

  logs: 'Logs',
  logsSub: 'Follow app events and errors while troubleshooting.',
  logAll: 'All',
  logInfo: 'Info',
  logWarn: 'Warning',
  logError: 'Error',
  logClear: 'Clear',
  logExport: 'Export log',
  logEmpty: 'No log entries yet.',

  logAppStarted: 'Application started',
  logUnhandled: 'Unhandled error: {msg}',
  logServiceUp: 'Connected to the AI service',
  logServiceDown: 'Lost the connection to the AI service',
  logWsOpen: 'Session channel open (WebSocket)',
  logWsClosed: 'Session channel closed',
  logSessionStart: 'Session started · {title}',
  logSessionStop: 'Session stopped',
  logModelsLoading: 'Loading models',
  logModelsReady: 'Models are ready in memory',
  logModelsFailed: 'Loading models failed: {msg}',
  logModelsUnloaded: 'Models freed from memory',
  logPresetChanged: 'Preset changed to {preset}',
  logModelsDeleted: 'Models deleted from disk, freed {size}',
  logModelDownloaded: 'Downloaded model {name}',
  logModelDeleted: 'Removed one model, freed {size}',
  logModelsDirChanged: 'Model folder changed to {dir}',
  logHfTokenSaved: 'Hugging Face access token saved',
  logHfTokenCleared: 'Hugging Face access token removed',
  logImportStart: 'Started processing {name}',
  logImportDone: 'Finished {name} · {count} segments',
  logImportCancelled: 'Cancelled the running file',
  logImportFailed: 'Failed to process {name}: {msg}',
  logBenchDone: 'Latency run finished · {total} ms total',
  logBenchFailed: 'Latency run failed: {msg}',
  logEvalStart: 'Evaluating {n} cases',
  logEvalDone: 'Evaluated {n} cases — error {err}, chrF {chrf}',
  logEvalFailed: 'Evaluation failed: {msg}',

  evalSub: 'Run a sample set through the system and score it.',
  evalBundledSet: 'Bundled sample set',
  evalCustomSet: 'Your own set',
  evalSetSummary:
    '{n} cases · {recorded} with real recordings · {synthetic} using synthetic speech',
  evalPickFile: 'Load JSON file',
  evalUseBundled: 'Use bundled set',
  evalQuick: 'Quick run (3 cases)',
  evalRun: 'Run evaluation',
  evalRunning: 'Scoring {id}…',
  evalFailed: 'Evaluation failed',
  evalBadFile: 'Could not read the file',
  evalEmptyFile: 'The file has no cases.',
  evalSyntheticT: 'Some cases ran on synthetic speech',
  evalSyntheticB:
    'Cases without a recording are spoken by the app and fed back to ASR. Synthetic speech is clean and even, so the numbers are OPTIMISTIC — for report-grade numbers, record real speech and point the `audio` field at it.',
  evalSyntheticBadge: 'synthetic',
  evalCancelledNote: 'Stopped early — the table below only covers the cases already scored.',
  evalScriptNote:
    'These numbers are for quick checks and comparing configurations. Report tables come from `make eval-asr` / `make eval-mt`, which use jiwer + spBLEU so they line up with the published NLLB-200 figures.',
  evalLowerBetter: 'lower is better',
  evalHigherBetter: 'higher is better',
  evalAsrP50: 'ASR p50',
  evalAsrP90: 'ASR p90',
  evalMtP90: 'MT p90',
  evalRtfP90: 'RTF p90',
  evalRtfOk: 'faster than real time',
  evalRtfSlow: 'slower than real time',
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

  dirTitle: 'Application data folder',
  dirDesc:
    'The path below is where models are downloaded to and loaded from — point it at another drive if your local disk is full. The list underneath is everything the app writes to disk.',
  dirBrowse: 'Choose folder…',
  dirUsed: 'Total',
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
  stModels: 'Models',
  stHistory: 'History',
  stCache: 'Cache',
  cleanBtn: 'Clean',
  emptyDir: 'empty',
  cleanHint: 'Clearing the cache is always safe; deleting models or history loses data.',
  cleanNoLogs:
    'There is no Log row because the app writes no log files: the AI service prints to stdout and the UI log lives in memory only.',
  confirmClearHistory: 'Delete the entire translation history? This cannot be undone.',
  logCacheCleared: 'Application cache cleared',

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
  reviewTitle: 'Review before speaking',
  reviewSend: 'Send',
  reviewDiscard: 'Discard',
  reviewAutoIn: 'auto-send in',
  reviewHint: 'Enter to send · Esc to discard',
  reviewSectionTitle: 'Review before speaking',
  reviewSectionDesc:
    'Pause so you can edit the translation before it is spoken into the meeting. More accurate, but every sentence waits for you.',
  reviewOn: 'On',
  reviewOff: 'Off',
  reviewCountdownLbl: 'Auto-send after',
  reviewCountdownOff: 'Never auto-send',
  reviewMidSession: 'Changing this during a running session takes effect on the next session.',
  hfTitle: 'Hugging Face Token',
  hfDesc: 'Token for downloading gated models. Held by the AI service, never by the browser.',
  hfPh: 'hf_xxxxxxxxxxxxxxxxxxxx',
  hfSave: 'Save token',
  hfClear: 'Remove token',
  hfVerify: 'Check',
  hfVerifying: 'Asking huggingface.co…',
  hfSaved: 'Token {hint} saved — held by the AI service, not by the browser.',
  hfNone: 'No token yet. Only needed for gated models (pyannote, for speaker separation).',
  hfFromEnv: 'Using the token from the LLVT_HF_TOKEN environment variable ({hint}).',
  hfInherited: 'Using the HF_TOKEN variable already set in the environment ({hint}).',
  hfLocked: 'LLVT_HF_TOKEN is in charge — unset it to change the token from the app.',
  hfOkUser: 'Token works — account {user}.',
  hfBadToken: 'Token rejected: {error}',
  hfWhy:
    'The token is only needed for the FIRST download of a gated model; after that the service runs offline as usual. This is the only time the app reaches the Internet outside model downloads.',
  hfReloadHint: 'Added a token to fix a failed download? Hit "Reload" on the Models screen.',
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

  importSub: 'Turn audio or video files into text.',
  dropTitle: 'Drag & drop audio / video',
  dropSub:
    'Supports MP3, WAV, M4A, FLAC, OGG, WebM, Opus · and MP4, MOV, MKV, 3GP (audio extracted automatically) — multiple files OK',
  browseFiles: 'Choose files',
  queueTitle: 'Processing queue',
  queueDone: 'done',
  queuePendingN: 'queued',
  queuePending: 'In queue',
  queueDecoding: 'Decoding…',
  phaseExtract: 'Extracting audio',
  videoBadge: 'VIDEO',
  queueProcessing: 'Processing…',
  queueOk: 'Completed',
  queueError: 'Failed',
  queueCancelled: 'Cancelled',
  cancelBtn: 'Cancel',
  cancelling: 'Stopping…',
  transcriptFmt: 'Format',
  copyBtn: 'Copy',
  copied: 'Copied',
  downloadBtn: 'Download',
  clearDone: 'Clear finished',
  retryTip: 'Run again',
  removeTip: 'Remove from queue',
  durationLbl: 'Duration',
  diarizeLbl: 'Speaker labels',
  diarizeOff:
    'Speaker separation is off in the service. Install `uv sync --extra diarization` and set LLVT_DIARIZATION_ENABLED=true.',
  diarizeHint:
    'Label each segment with who spoke. Costs one extra pass over the whole file before transcription.',
  impFileLang: 'Language in the file',
  impTargetLang: 'Translate to',
  impNoTranslate: "Don't translate",
  impSave: 'Save to history',
  impSaved: 'saved to History',
  impHistoryOff: 'History saving is off in Settings.',
  impDecodeFailed:
    'Could not get audio out of this file — it may have no audio track, or be corrupt.',
  impBadContainer:
    'This container is not readable on this machine (AVI, WMV, FLV, MPEG-TS). Convert it to MP4 or MKV and try again.',
  impTooLarge: 'The file is larger than 2 GB — trim or re-encode it before importing.',
  impNoSpeech: 'No speech found in this file.',
  impSegments: 'segments',
  impLoadHint: 'Models load before the first file; the first run can take a few minutes.',
  impBusySession:
    'A translation session is running — stop it before importing, both share the same models.',
  impDiarizing: 'Separating speakers…',
  impSpeakers: 'speakers',
  speakerN: 'Speaker {n}',
  speakerUnknown: 'Unknown speaker',

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
