import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// The web build used to print "*** WEB BUILD OK ***" after the engine worker had FAILED: the
// helper that runs the worker scripts caught the child's non-zero exit and only warned. The
// result boots into a shell that cannot run a single game, while the build says it is fine -
// and that line gets trusted. Anything that leaves the app unable to play must stop the build.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const CR = String.fromCharCode(13)
const build = fs.readFileSync(path.join(DIR, 'build.js'), 'utf8').split(CR).join('')
const worker = fs.readFileSync(path.join(DIR, 'build-engine-worker.js'), 'utf8').split(CR).join('')

describe('a failed engine step stops the build', () => {
  it('throws instead of warning and carrying on', () => {
    const sub = build.slice(build.indexOf('const sub = ('), build.indexOf('\n    }', build.indexOf('const sub = (')))
    expect(sub).toContain('throw new BuildStepError(help)')
    expect(sub).not.toContain('console.log')
  })

  it('still describes the failure as fatal, not as a warning', () => {
    expect(build).not.toContain('Non-fatal: without these the app still boots')
  })

  it('reports failure and a non-zero exit', () => {
    const tail = build.slice(build.indexOf('WEB BUILD FAILED'))
    expect(tail).toContain('process.exit(1)')
  })

  it('prints the actionable message rather than a stack for a known failure', () => {
    expect(build).toContain('e instanceof BuildStepError')
  })
})

describe('the OK line cannot be reached after a failure', () => {
  it('comes after both engine steps', () => {
    const versionStep = build.indexOf("['--version-only']")
    const workerStep = build.indexOf("sub('build-engine-worker.js', [],")
    // the PRINT, not the comments that mention it
    const ok = build.indexOf('console.log(' + String.fromCharCode(39, 92) + 'n*** WEB BUILD OK')
    expect(versionStep).toBeGreaterThan(-1)
    expect(workerStep).toBeGreaterThan(versionStep)
    expect(ok).toBeGreaterThan(workerStep)
  })

  it('is guarded even if the worker step succeeds without producing the file', () => {
    expect(build).toContain('engine worker missing from dist/ after the worker build reported success')
  })

  it('checks for the worker before hashing it into a versioned name', () => {
    const check = build.indexOf('engine worker missing from dist/')
    const hash = build.indexOf("crypto.createHash('sha256').update(fs.readFileSync(workerPlain))")
    expect(check).toBeLessThan(hash)
  })
})

describe('the child really does signal failure', () => {
  it('exits non-zero, which is what the helper now relies on', () => {
    expect(worker).toContain('process.exit(1)')
    expect(worker).toContain('ENGINE WORKER BUILD FAILED')
  })

  it('refuses a stale engine dist, the case that started this', () => {
    expect(worker).toContain('Engine dist/ is STALE.')
  })
})
