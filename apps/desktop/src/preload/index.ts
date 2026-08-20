import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'

// Cấu hình kết nối tới Local AI Service (chỉ localhost). Expose an toàn cho renderer.
const llvt = {
  aiBaseUrl: 'http://127.0.0.1:8756',
  aiWsUrl: 'ws://127.0.0.1:8756/ws',
  platform: process.platform,
  // Mở hộp thoại chọn thư mục của hệ điều hành; '' nghĩa là người dùng huỷ.
  chooseDirectory: (current?: string): Promise<string> =>
    ipcRenderer.invoke('dialog:chooseDirectory', current),
  // Cache của Chromium trong thư mục userData — đo và dọn được.
  cacheBytes: (): Promise<number> => ipcRenderer.invoke('app:cacheBytes'),
  clearCache: (): Promise<void> => ipcRenderer.invoke('app:clearCache')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('llvt', llvt)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.llvt = llvt
}
