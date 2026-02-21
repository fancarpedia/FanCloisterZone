const path = require('path')
const fs = require('fs')

const ICONS_DIR = 'build/icons/'

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

const windowsOS = {
  win: {
    icon: ICONS_DIR + 'win-icon-fan-6.1.ico',
    publisherName: 'farin',
    target: 'nsis'
  },
  nsis: {
    differentialPackage: true
  }
}

const linuxOS = {
  linux: {
    icon: ICONS_DIR,
    target: 'AppImage'
  }
}

const macOS = {
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['universal']
      }
    ],
    icon: ICONS_DIR + 'fcz-icon.icns',
    minimumSystemVersion: '10.13.6',
    identity: null  // disable code signing on CI
  },
  dmg: {
    contents: [
      { x: 410, y: 150, type: 'link', path: '/Applications' },
      { x: 130, y: 150, type: 'file' }
    ]
  }
}

module.exports = {
  asar: false,
  productName: 'FanCloisterZone',
  appId: 'com.jcloisterzone.fan',
  artifactName: 'fancloisterzone-${version}.${ext}',
  directories: {
    output: 'build'
  },
  files: [
    'package.json',
    { from: 'dist/main/', to: 'dist/main/' },
    { from: 'dist/renderer', to: 'dist/renderer/' },
    { from: 'src/resources/', to: 'dist/resources/' }
  ],
  extraResources: [
    'Engine.jar',
    'icons',
    { from: 'src/extraResources/', to: '' }
  ],
  afterPack,
  ...windowsOS,
  ...linuxOS,
  ...macOS
}