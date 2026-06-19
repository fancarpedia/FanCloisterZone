const https = require('https')
const fs = require('fs')

const ENGINE_VERSION = 'v7.0.0-alpha.5'
const ENGINE_FILE = 'jcz-engine.js'
const VERSION_MARKER = '.engine-version'
const ENGINE_URL =
  `https://github.com/fancarpedia/JCloisterZoneEngine/releases/download/${ENGINE_VERSION}/${ENGINE_FILE}`

function download (url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, res1 => {
        // GitHub redirects release-asset URLs to the actual storage location
        https
          .get(res1.headers.location, res2 => {
            if (res2.statusCode !== 200) {
              reject(new Error(`HTTP ${res2.statusCode} for ${url}`))
              return
            }
            const w = fs.createWriteStream(dest)
            res2.pipe(w)
            w.on('finish', () => w.close(resolve))
            w.on('error', reject)
            res2.on('error', reject)
          })
          .on('error', reject)
      })
      .on('error', reject)
  })
}

const haveCurrent =
  fs.existsSync(ENGINE_FILE) &&
  fs.existsSync(VERSION_MARKER) &&
  fs.readFileSync(VERSION_MARKER, 'utf8').trim() === ENGINE_VERSION

if (haveCurrent) {
  console.log(`Engine ${ENGINE_VERSION} already present (${ENGINE_FILE}).`)
} else {
  console.log(`Downloading engine ${ENGINE_VERSION} -> ${ENGINE_FILE} ...`)
  download(ENGINE_URL, ENGINE_FILE)
    .then(() => {
      fs.writeFileSync(VERSION_MARKER, ENGINE_VERSION)
      console.log('Engine downloaded.')
    })
    .catch(err => {
      console.error('Engine download failed:', err.message)
      process.exit(1)
    })
}
