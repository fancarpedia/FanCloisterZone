// Browser stub for `child_process` that makes the ENGINE WORK IN A BROWSER — without touching any
// app source.
//
// On desktop, plugins/engine.js spawns the engine as a Node child process and talks to it over
// stdio (one command line in, one JSON state line out). A browser cannot spawn processes — but the
// TypeScript engine runs fine in a Web Worker (proven byte-identical to Node across all 273 replay
// fixtures).
//
// So rather than rewriting plugins/engine.js, `spawn()` here returns a FAKE ChildProcess whose
// stdin/stdout/stderr are wired to a Worker running the engine. plugins/engine.js cannot tell the
// difference: it writes lines to .stdin and reads lines off .stdout exactly as before.
//
// The worker script is built separately: node web-build/build-engine-worker.js

// Minimal EventEmitter — the engine plugin only uses on() / emit().
class Emitter {
  constructor () { this._h = {} }
  on (ev, cb) { (this._h[ev] || (this._h[ev] = [])).push(cb); return this }
  once (ev, cb) { return this.on(ev, cb) }
  emit (ev, ...args) { (this._h[ev] || []).forEach((cb) => cb(...args)) }
  removeListener () { return this }
}

let pidSeq = 1

class WorkerProcess extends Emitter {
  constructor () {
    super()
    this.pid = pidSeq++
    this.stdin = new Emitter()
    this.stdout = new Emitter()
    this.stderr = new Emitter()
    this._dead = false

    // Relative URL: resolves against the document base, so the build still works when hosted in a
    // subdirectory (https://host/fcz/) rather than at the domain root.
    // build.js injects a CONTENT-HASHED filename (jcz-engine.worker.<hash>.js) via
    // window.__FCZ_ENGINE_WORKER__ so a rebuilt engine isn't served stale from cache; fall back to
    // the plain name if it isn't set (e.g. the worker built outside build.js).
    const workerUrl = (typeof window !== 'undefined' && window.__FCZ_ENGINE_WORKER__) || './jcz-engine.worker.js'
    try {
      this.worker = new Worker(workerUrl)
    } catch (e) {
      // surface as a spawn failure, exactly like ENOENT would on desktop
      setTimeout(() => this.emit('error', e), 0)
      return
    }

    this.worker.onmessage = (ev) => {
      const m = ev.data || {}
      if (m.type === 'stdout') this.stdout.emit('data', m.data)
      else if (m.type === 'stderr') this.stderr.emit('data', m.data)
    }
    this.worker.onerror = (e) => {
      this.emit('error', new Error('Engine worker error: ' + (e.message || e)))
    }

    // plugins/engine.js writes a command line here; forward it to the worker.
    this.stdin.write = (cmd, _enc, cb) => {
      if (this._dead) { if (cb) cb(new Error('Engine worker terminated')); return false }
      // strip the trailing newline the plugin appends — the worker is line-oriented already
      for (const line of String(cmd).split('\n')) {
        if (line !== '') this.worker.postMessage({ type: 'line', line })
      }
      if (cb) cb(null)
      return true
    }
  }

  kill () {
    if (this._dead) return
    this._dead = true
    if (this.worker) this.worker.terminate()
    this.emit('exit', 0)
  }
}

export const spawn = () => new WorkerProcess()

// The app probes the engine version at startup with `execFile(exe, [...args, '--version'])` and
// parses stdout. There is no process to run, so answer from the version captured at build time.
let VERSION = 'jcloisterzone-engine-ts (web)'
try {
  // eslint-disable-next-line
  VERSION = require('../engine-version.json').version || VERSION
} catch (e) { /* keep default */ }

export const execFile = (_exe, _args, _opts, cb) => {
  const done = typeof _opts === 'function' ? _opts : cb
  if (done) setTimeout(() => done(null, VERSION + '\n', ''), 0)
  return new Emitter()
}

const boom = (name) => () => { throw new Error('[web-build] Node-only API not available in browser: ' + name) }
export const exec = boom('child_process.exec')
export const fork = boom('child_process.fork')

export default { spawn, execFile, exec, fork }
