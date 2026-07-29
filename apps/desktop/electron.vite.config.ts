import { readFileSync } from 'fs'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

// Phiên bản lấy từ package.json để giao diện khỏi hardcode một số rời rạc.
const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf-8')) as {
  version: string
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    define: { __APP_VERSION__: JSON.stringify(version) },
    plugins: [react()]
  }
})
