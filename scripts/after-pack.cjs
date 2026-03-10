const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

/**
 * Hook afterPack de electron-builder.
 * macOS: re-firma ad-hoc (evita "app dañada" sin Developer ID).
 * Windows/Linux: no-op.
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appOutDir = context.appOutDir
  const appFiles = fs.readdirSync(appOutDir).filter(f => f.endsWith('.app'))
  if (appFiles.length === 0) return

  const appPath = path.join(appOutDir, appFiles[0])
  console.log('[afterPack] Firmando ad-hoc: ' + appPath)
  execSync('codesign --deep --force --sign - "' + appPath + '"', { stdio: 'inherit' })
}
