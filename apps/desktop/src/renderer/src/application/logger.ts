// Ghi nhật ký sự kiện ứng dụng — cổng duy nhất mà phần còn lại của app gọi tới.
//
// Nội dung dòng nhật ký dựng bằng hàm nhận vào từ điển: `logInfo('models', L =>
// L.logModelsReady)`. Làm vậy để câu chữ theo đúng ngôn ngữ giao diện TẠI LÚC ghi mà
// nơi gọi không phải tự đi lấy từ điển; đổi ngôn ngữ sau đó không viết lại các dòng cũ.
//
// Gọi được cả ngoài React (SessionController, adapter) vì chỉ đụng vào getState().

import type { LogLevel, LogSource } from '../domain/enums'
import { useLogStore } from '../stores/log-store'
import { useUiStore } from '../stores/ui-store'
import { dict, type Dict } from './i18n'

type Build = (L: Dict) => string

function write(level: LogLevel, source: LogSource, build: Build): void {
  const L = dict(useUiStore.getState().uiLanguage)
  useLogStore.getState().append(level, source, build(L))
}

export function logInfo(source: LogSource, build: Build): void {
  write('info', source, build)
}

export function logWarn(source: LogSource, build: Build): void {
  write('warn', source, build)
}

export function logError(source: LogSource, build: Build): void {
  write('error', source, build)
}

/** Thông điệp của một lỗi bất kỳ (Error, chuỗi, object lạ) để nhét vào dòng nhật ký. */
export function errorText(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
