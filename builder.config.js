const path = require('path')
const fs = require('fs')

async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appResources = path.join(
    context.appOutDir,
    'FanCloisterZone.app/Contents/Resources/app'
  )

  // Remove all node_gyp_bins folders (contain arch-specific python symlinks)
  removeGlob(appResources, 'node_gyp_bins')

  // Remove all .a static library files
  removeByExtension(appResources, '.a')
}

function removeGlob(baseDir, folderName) {
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === folderName) {
          fs.rmSync(fullPath, { recursive: true, force: true })
          console.log(`Removed dir: ${fullPath}`)
        } else {
          walk(fullPath)
        }
      }
    }
  }
  walk(baseDir)
}

function removeByExtension(baseDir, ext) {
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.name.endsWith(ext)) {
        fs.rmSync(fullPath, { force: true })
        console.log(`Removed file: ${fullPath}`)
      }
    }
  }
  walk(baseDir)
}