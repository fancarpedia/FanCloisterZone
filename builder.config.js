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
    icon: ICONS_DIR + 'win-icon-fan-6.1.ico', // App Icon
    publisherName: 'farin',
    target: 'nsis'
  },
  nsis: {
    differentialPackage: true,
    installerIcon: ICONS_DIR + 'win-icon-fan-6.1.ico',    // Installer Icon
    uninstallerIcon: ICONS_DIR + 'win-icon-fan-6.1.ico',  // Uninstaller icon
    installerHeaderIcon: ICONS_DIR + 'win-icon-fan-6.1.ico' // Small Header Icon
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

// Build channel: `FCZ_CHANNEL=alpha yarn package` produces a SEPARATE app
// (distinct appId + productName) that installs alongside the stable build with its own
// install dir, shortcuts and userData. Default (unset) = stable.
const isAlpha = process.env.FCZ_CHANNEL === 'alpha'

module.exports = {
  asar: false,
  productName: isAlpha ? 'FanCloisterZone Alpha' : 'FanCloisterZone',
  appId: isAlpha ? 'com.jcloisterzone.fan.alpha' : 'com.jcloisterzone.fan',
  artifactName: 'fancloisterzone' + (isAlpha ? '-alpha' : '') + '-${version}.${ext}',
  // Two roots must both be isolated for a side-by-side Alpha app:
  //  * userData (%APPDATA%/<app.getName()>) → app.getName() prefers `productName`.
  //  * install dir (%LOCALAPPDATA%/Programs/<name>) → derived from package.json `name`.
  // The packaged package.json has name:"fancloisterzone" and no productName, so without
  // overriding BOTH the Alpha app would share stable's userData AND its install dir (and
  // thus everything in resources/: jcz-engine.js, built-in addons, expansions, icons,
  // renderer code). extraMetadata injects both into the packaged package.json:
  //   name        → install dir becomes %LOCALAPPDATA%/Programs/fancloisterzone-alpha
  //   productName → app.getName()/userData becomes "FanCloisterZone Alpha"
  // ALPHA ONLY: stable keeps name "fancloisterzone" so existing installs keep their
  // install dir and config folder.
  ...(isAlpha ? { extraMetadata: { name: 'fancloisterzone-alpha', productName: 'FanCloisterZone Alpha' } } : {}),
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
    'jcz-engine.js',
    'icons',
    { from: 'src/extraResources/', to: '' }
  ],
  afterPack,
  ...windowsOS,
  ...linuxOS,
  ...macOS
}