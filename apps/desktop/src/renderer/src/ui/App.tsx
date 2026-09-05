// Khung ứng dụng: cửa sổ kính mờ (thanh tiêu đề + sidebar + vùng nội dung) và
// router đơn giản theo `screen` trong ui-store.
//
// Mọi màn được dựng một lần rồi **giữ nguyên**, đổi tab chỉ ẩn/hiện. Trước đây màn cũ
// bị tháo bỏ nên mất sạch việc đang làm: hàng đợi nhập tệp biến mất (trong khi service
// vẫn chạy tiếp ngầm), ô tìm kiếm ở Lịch sử, bản nháp ở Cài đặt cũng vậy.

import { useEffect, useLayoutEffect, useRef, type JSX, type ReactNode } from 'react'
import type { ScreenId } from '../domain/enums'
import { useAppEventLog } from '../hooks/use-app-log'
import { useServiceConfig } from '../hooks/use-config'
import { useHealth } from '../hooks/use-health'
import { useSession } from '../hooks/use-session'
import { useDict, useResolvedTheme } from '../hooks/use-ui'
import { useUiStore } from '../stores/ui-store'
import { RecoveryBanner } from './components/RecoveryBanner'
import { Sidebar, type ServiceStatus } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { AboutScreen } from './screens/AboutScreen'
import { DiagnosticsScreen } from './screens/DiagnosticsScreen'
import { EvaluateScreen } from './screens/EvaluateScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { ImportScreen } from './screens/ImportScreen'
import { LogsScreen } from './screens/LogsScreen'
import { ModelsScreen } from './screens/ModelsScreen'
import { SessionScreen } from './screens/SessionScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SetupScreen } from './screens/SetupScreen'

/** Một màn luôn tồn tại; màn không được chọn thì `display:none`.
 *
 * `contents` (chứ không phải `block`) cho màn đang mở: bọc thêm một hộp nữa sẽ phá
 * layout flex của `<main>` — màn Phiên dịch xin `flex-1` để có cột phụ đề cuộn riêng.
 */
function Screen({ show, children }: { show: boolean; children: ReactNode }): JSX.Element {
  return <div className={show ? 'contents' : 'hidden'}>{children}</div>
}

export default function App(): JSX.Element {
  const actions = useSession()
  const screen = useUiStore((s) => s.screen)
  const theme = useResolvedTheme()
  const health = useHealth()
  const L = useDict()
  useAppEventLog()

  // Vùng nội dung là một khung cuộn dùng chung, nên phải nhớ vị trí cuộn của từng màn:
  // không nhớ thì quay lại màn dài sẽ rơi vào một chỗ ngẫu nhiên do màn kia để lại.
  const mainRef = useRef<HTMLElement>(null)
  const scrollTops = useRef<Partial<Record<ScreenId, number>>>({})
  const previousScreen = useRef(screen)
  useLayoutEffect(() => {
    const main = mainRef.current
    if (main === null) return
    if (previousScreen.current !== screen) {
      scrollTops.current[previousScreen.current] = main.scrollTop
      previousScreen.current = screen
      main.scrollTop = scrollTops.current[screen] ?? 0
    }
  }, [screen])

  // Chủ đề đặt trên <html> để cả nền body lẫn thanh cuộn đổi theo.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.title = L.appName
  }, [theme, L])

  // Service sống chưa đủ để nói "Sẵn sàng Offline": model chỉ vào bộ nhớ khi bấm
  // "Khởi động model" hoặc khi bắt đầu phiên, nên phải xem `stages` có gì chưa.
  const config = useServiceConfig()
  const modelsLoaded = (config.data?.stages.length ?? 0) > 0
  const status: ServiceStatus = health.isSuccess
    ? modelsLoaded
      ? 'ready'
      : 'idle'
    : health.isLoading
      ? 'connecting'
      : 'down'

  return (
    <div
      data-theme={theme}
      className="flex h-screen w-full flex-col overflow-hidden bg-(color:--app-base) bg-(image:--app-bg) text-fg"
    >
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar status={status} />
        {/* flex-col để màn nào cần chiều cao xác định (Phiên dịch: cột phụ đề cuộn
            riêng) thì xin `flex-1`; màn khác vẫn cao theo nội dung như cũ. */}
        <main ref={mainRef} className="cs flex min-w-0 flex-1 flex-col overflow-y-auto">
          <RecoveryBanner />
          <Screen show={screen === 'session'}>
            <SessionScreen actions={actions} />
          </Screen>
          <Screen show={screen === 'import'}>
            <ImportScreen />
          </Screen>
          <Screen show={screen === 'setup'}>
            <SetupScreen />
          </Screen>
          <Screen show={screen === 'models'}>
            <ModelsScreen />
          </Screen>
          <Screen show={screen === 'diagnostics'}>
            <DiagnosticsScreen />
          </Screen>
          <Screen show={screen === 'evaluate'}>
            <EvaluateScreen />
          </Screen>
          <Screen show={screen === 'history'}>
            <HistoryScreen />
          </Screen>
          <Screen show={screen === 'settings'}>
            <SettingsScreen />
          </Screen>
          <Screen show={screen === 'about'}>
            <AboutScreen />
          </Screen>
          <Screen show={screen === 'logs'}>
            <LogsScreen />
          </Screen>
        </main>
      </div>
    </div>
  )
}
