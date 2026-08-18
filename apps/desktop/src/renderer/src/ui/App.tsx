// Khung ứng dụng: cửa sổ kính mờ (thanh tiêu đề + sidebar + vùng nội dung) và
// router đơn giản theo `screen` trong ui-store.

import { useEffect, type JSX } from 'react'
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
import { HistoryScreen } from './screens/HistoryScreen'
import { ImportScreen } from './screens/ImportScreen'
import { ModelsScreen } from './screens/ModelsScreen'
import { SessionScreen } from './screens/SessionScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SetupScreen } from './screens/SetupScreen'

export default function App(): JSX.Element {
  const actions = useSession()
  const screen = useUiStore((s) => s.screen)
  const theme = useResolvedTheme()
  const health = useHealth()
  const L = useDict()

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
      <TitleBar offlineReady={health.data?.offlineReady ?? false} />
      <div className="flex min-h-0 flex-1">
        <Sidebar status={status} />
        <main className="cs min-w-0 flex-1 overflow-y-auto">
          <RecoveryBanner />
          {screen === 'session' && <SessionScreen actions={actions} />}
          {screen === 'import' && <ImportScreen />}
          {screen === 'setup' && <SetupScreen />}
          {screen === 'models' && <ModelsScreen />}
          {screen === 'diagnostics' && <DiagnosticsScreen />}
          {screen === 'history' && <HistoryScreen />}
          {screen === 'settings' && <SettingsScreen />}
          {screen === 'about' && <AboutScreen />}
        </main>
      </div>
    </div>
  )
}
