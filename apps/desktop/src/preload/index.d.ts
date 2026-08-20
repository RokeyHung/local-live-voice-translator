import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    llvt: {
      aiBaseUrl: string
      aiWsUrl: string
      platform: string
      chooseDirectory: (current?: string) => Promise<string>
      cacheBytes: () => Promise<number>
      clearCache: () => Promise<void>
    }
  }
}
