const path = require('path')
const fs = require('fs')

const ICONS_DIR = 'build/icons/'

// afterPack hook: remove arch-specific .a files that would cause
// universal build SHA mismatch (register-scheme/nothing.a)
async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const filesToRemove = [
    path.join(
      context.appOutDir,
      'FanCloisterZone.app/Contents/Resources/app/node_modules/register-scheme/build/Release/nothing.a'
    )
  ]

  for (const f of filesToRemove) {
    if (fs.existsSync(f)) {
      fs.rmSync(f)
      console.log(`Removed arch-specific file: ${f}`)
    }
  }
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
    identity: null
  },
  dmg: {
    contents: [
      {
        x: 410,
        y: 150,
        type: 'link',
        path: '/Applications'
      },
      {
        x: 130,
        y: 150,
        type: 'file'
      }
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
    {
      from: 'dist/main/',
      to: 'dist/main/'
    },
    {
      from: 'dist/renderer',
      to: 'dist/renderer/'
    },
    {
      from: 'src/resources/',
      to: 'dist/resources/'
    }
  ],
  extraResources: [
    'Engine.jar',
    'icons',
    {
      from: 'src/extraResources/',
      to: ''
    }
  ],

  afterPack,

  ...windowsOS,
  ...linuxOS,
  ...macOS
}