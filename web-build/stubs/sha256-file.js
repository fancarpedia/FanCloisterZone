// `sha256-file` for the browser.
//
// plugins/addons.js verifies a downloaded .jca SYNCHRONOUSLY:
//     const checksum = sha256File(zipName)
//
// Web Crypto (crypto.subtle) is async, so it cannot be used here. But webpack polyfills Node's
// `crypto` with crypto-browserify, whose createHash() IS synchronous — and fs.js keeps the bytes of
// files written this session in memory precisely so this check can read them back without I/O.
import { createHash } from 'crypto'
import { _memory, promises } from './fs.js'
import * as opfs from './storage.js'

export default function sha256File (path, cb) {
  const key = opfs.norm(path)
  const bytes = _memory.get(key)

  if (!bytes) {
    const err = new Error('[web-build] sha256-file: ' + path + ' was not written this session, ' +
      'so its bytes are not in memory and cannot be hashed synchronously.')
    if (cb) { cb(err); return }
    throw err
  }

  const hex = createHash('sha256').update(Buffer.from(bytes)).digest('hex')
  if (cb) cb(null, hex)
  return hex
}

export { sha256File }
