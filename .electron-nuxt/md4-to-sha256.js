/*
  Node 17+ (OpenSSL 3) no longer offers the MD4 hash, but webpack 4 (Nuxt 2) names its chunks and
  caches with crypto.createHash('md4') and fails with "error:0308010C:digital envelope
  routines::unsupported". Hand it SHA-256 instead — only the build's own hashes change, never the
  built app. Require this BEFORE webpack / nuxt are loaded.

  `NODE_OPTIONS=--openssl-legacy-provider` would do the same on Node 17+, but Node 16 (OpenSSL 1.1)
  refuses to start with it, so this shim keeps the build working on both.

  This module cannot contain any external libraries (it runs before anything else is loaded).
 */
const crypto = require('crypto')

if (!crypto.createHash.md4ToSha256) {
  const createHash = crypto.createHash
  const patched = (algorithm, ...rest) => createHash(algorithm === 'md4' ? 'sha256' : algorithm, ...rest)
  patched.md4ToSha256 = true
  crypto.createHash = patched
}
