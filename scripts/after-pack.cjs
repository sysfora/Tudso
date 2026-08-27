const { execFileSync } = require('node:child_process')
const { chmodSync } = require('node:fs')
const { join } = require('node:path')

/** Strip quarantine from the packaged .app so a later Developer ID signature stays valid. */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  execFileSync('xattr', ['-cr', app])
  try {
    chmodSync(join(__dirname, '..', 'build', 'mac-install.command'), 0o755)
  } catch {
    // unsigned helper is optional for signed builds
  }
}
