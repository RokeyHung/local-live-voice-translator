import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  session,
  shell,
  systemPreferences
} from 'electron'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1040,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b1120',
    // macOS: giấu thanh tiêu đề nhưng giữ nút đèn giao thông, để thanh tiêu đề
    // trong giao diện (TitleBar.tsx) chừa lề trái cho chúng.
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' as const } : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Hộp thoại chọn thư mục (màn Cài đặt → thư mục lưu model). Renderer nằm trong
  // sandbox nên không tự mở được hộp thoại của hệ điều hành; trả '' khi người dùng huỷ.
  ipcMain.handle('dialog:chooseDirectory', async (_event, current?: string) => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      ...(current ? { defaultPath: current } : {})
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? '' : (result.filePaths[0] ?? '')
  })

  // Cấp quyền thu audio cho renderer (getUserMedia). Chỉ localhost/desktop nên an toàn.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media')
  })
  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('microphone').catch(() => undefined)
  }

  // Thu âm thanh hệ thống (giọng phía cuộc họp). Renderer gọi getDisplayMedia();
  // Electron bắt buộc phải có handler này, nếu không lời gọi bị từ chối thẳng.
  //
  // `audio: 'loopback'` lấy đúng luồng ra của hệ điều hành — macOS 13+ đi qua
  // ScreenCaptureKit, Windows qua WASAPI loopback. Chromium yêu cầu kèm video
  // nên vẫn phải chọn một nguồn màn hình; renderer bỏ track video ngay sau đó.
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen'], fetchWindowIcons: false })
        .then((sources) => {
          // Không có màn hình nào (chưa cấp quyền Ghi màn hình) → hủy yêu cầu.
          if (sources.length === 0) return callback({})
          callback({ video: sources[0], audio: 'loopback' })
        })
        .catch(() => callback({}))
    },
    // Bỏ qua bộ chọn của hệ điều hành: ta luôn lấy loopback toàn hệ thống, người
    // dùng không phải chọn cửa sổ mỗi lần bắt đầu phiên.
    { useSystemPicker: false }
  )

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
