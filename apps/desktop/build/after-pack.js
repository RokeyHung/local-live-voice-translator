// Ký ad-hoc lại toàn bộ .app sau khi electron-builder đã nhét service Python vào.
//
// Vì sao cần: bản Electron tải về đã được Apple ký sẵn, nhưng thêm 1,6 GB vào
// Contents/Resources là phá dấu niêm phong đó (`codesign -dv` báo
// "Sealed Resources=none"). Trên máy đang build thì vẫn chạy, còn máy khác tải
// .dmg về — file dính cờ quarantine — sẽ bị Gatekeeper từ chối thẳng với thông
// báo "bị hỏng". Ký ad-hoc niêm phong lại bundle, nên app mở được sau khi người
// dùng chuột phải → Mở (docs/09).
//
// Ad-hoc chứ không phải ký thật vì đồ án không có tài khoản Apple Developer.
// Có tài khoản thì bỏ `identity: null` trong electron-builder.yml và xoá hook
// này — electron-builder sẽ tự ký và công chứng.

const { execFileSync } = require('child_process')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`
  console.log(`  • ký ad-hoc  app=${appPath}`)

  // --deep là cách duy nhất ký hết được cây .dylib của torch/sherpa-onnx mà
  // không phải liệt kê tay vài nghìn file. Apple khuyên tránh --deep khi ký
  // thật, nhưng ad-hoc thì không có ràng buộc Team ID nào để làm sai.
  execFileSync(
    'codesign',
    [
      '--force',
      '--deep',
      '--sign',
      '-',
      '--entitlements',
      `${context.packager.info.buildResourcesDir}/entitlements.mac.plist`,
      appPath
    ],
    { stdio: 'inherit' }
  )

  // Ký xong mà không verify được thì bản cài coi như hỏng — dừng build luôn,
  // đừng để phát hiện lúc cắm máy chiếu.
  execFileSync('codesign', ['--verify', '--strict', appPath], { stdio: 'inherit' })
  console.log('  • ký ad-hoc xong, chữ ký hợp lệ')
}
