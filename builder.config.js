const ICONS_DIR = 'build/icons/'

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
    identity: null,             // disable code signing on CI
    singleArchFiles: '**/*.a',  // ← THE FIX: .a files differ per arch, don't require them to match
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
  ...windowsOS,
  ...linuxOS,
  ...macOS
}