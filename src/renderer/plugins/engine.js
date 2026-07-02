import path from 'path'
import crypto from 'crypto'
import { spawn } from 'child_process'
import debounce from 'lodash/debounce'
import Vue from 'vue'

class BaseEngine {
  // Reject the currently pending request (if any) so an awaiting caller fails fast instead of
  // hanging when the underlying process/socket dies.
  _rejectPending (err) {
    if (this.onMessage) {
      const { reject } = this.onMessage
      this.onMessage = null
      reject(err)
    }
  }

  // Mark the engine as permanently failed. Further writes reject immediately (rather than hanging
  // on a buffer that will never flush), the in-flight request is rejected, and — when `notify` —
  // the error handler is invoked so the UI can surface it.
  _fail (err, { notify = false } = {}) {
    const error = err instanceof Error
      ? err
      : new Error((err && (err.message || err.code)) || String(err) || 'Engine error')
    if (!this.failed) {
      this.failed = error
    }
    this._rejectPending(this.failed)
    if (notify && this.errHandler) {
      this.errHandler(this.failed.message)
    }
  }

  async enableBulkMode () {
    if (this.failed) throw this.failed
    this.bulkMode = true
    await this._write('%bulk on')
  }

  async disableBulkMode () {
    if (this.failed) throw this.failed
    this.bulkMode = false
    return new Promise((resolve, reject) => {
      this.onMessage = { resolve, reject }
      this._write('%bulk off').catch(reject)
    })
  }

  async write (cmd) {
    if (this.failed) throw this.failed
    await this._write(cmd)
  }

  writeMessage (message) {
    if (this.failed) return Promise.reject(this.failed)
    if (this.loggingEnabled) {
      console.groupCollapsed(message.type)
      console.log(message.payload)
      console.groupEnd()
    }

    if (this.bulkMode) {
      return this._write(JSON.stringify(message)).then(() => null)
    }
    return new Promise((resolve, reject) => {
      if (this.onMessage) {
        console.error('unresolved onMessage')
      }
      this.onMessage = { resolve, reject }
      this._write(JSON.stringify(message)).catch(reject)
    })
  }

  // Send a raw `%`-directive and await its single-line JSON response. Used for non-mutating
  // queries like `%placements <tileId>` (pre-draw needs the legal placements of a secret hand
  // tile, which the shared engine state can't expose). Does NOT change game state.
  query (cmd) {
    if (this.failed) return Promise.reject(this.failed)
    return new Promise((resolve, reject) => {
      if (this.onMessage) {
        console.error('unresolved onMessage')
      }
      this.onMessage = { resolve, reject }
      this._write(cmd).catch(reject)
    })
  }
}

class Engine extends BaseEngine {
  constructor (engineProcess, loggingEnabled) {
    super()
    this.engineProcess = engineProcess
    this.loggingEnabled = loggingEnabled
    this.onMessage = null
    this.bulkMode = false
    this.failed = null

    // A spawn failure (e.g. bad engine path / ENOENT) emits 'error' on the child process. Without
    // a listener Node throws and crashes the renderer — handle it and fail pending calls instead.
    this.engineProcess.on('error', err => {
      this._fail(err, { notify: true })
    })
    // If the engine dies mid-request, reject the in-flight call so the caller doesn't hang (no
    // dialog for an ordinary exit — kill() during teardown also lands here).
    this.engineProcess.on('exit', () => {
      this._fail(new Error('Engine process exited'), { notify: false })
    })
    // Guard the stdio streams too: a failed spawn can emit EPIPE on stdin/stdout, which crashes
    // the renderer if unhandled. Fail (rejecting any pending call) without a second dialog.
    this.engineProcess.stdin.on('error', err => this._fail(err, { notify: false }))
    this.engineProcess.stdout.on('error', err => this._fail(err, { notify: false }))

    let stdoutData = []
    let stderrData = []

    const emitError = debounce(() => {
      if (stderrData.length) {
        const data = stderrData.join('\n')
        this.errHandler && this.errHandler(data)
        stderrData = []
      }
    }, 100)

    console.log(`Engine started ${engineProcess.pid}`)

    this.engineProcess.stderr.on('data', data => {
      data = data.toString().trim() // convert buffer to string
      console.error(data)
      if (!data.startsWith('#')) {
        stderrData.push(data)
        emitError()
      }
    })

    this.engineProcess.stdout.on('data', data => {
      data = data.toString()
      if (!data) {
        return
      }

      if (!data.endsWith('\n')) {
        stdoutData.push(data)
        return
      } else if (stdoutData.length) {
        stdoutData.push(data)
        data = stdoutData.join('')
        stdoutData = []
      }

      try {
        const response = JSON.parse(data)
        const hash = crypto.createHash('sha1').update(data).digest('hex')
        if (loggingEnabled) {
          console.debug(response)
        }
        if (this.onMessage) {
          const { resolve } = this.onMessage
          this.onMessage = null
          resolve({ response, hash })
        }
      } catch (e) {
        console.error('Received invalid json: ' + data)
        console.error(e)
        if (this.onMessage) {
          const { reject } = this.onMessage
          this.onMessage = null
          reject(e)
        }
      }
    })
  }

  on (type, cb) {
    if (type === 'exit') {
      this.engineProcess.on('exit', cb)
    } else if (type === 'error') {
      this.errHandler = cb
    }
  }

  _write (cmd) {
    return new Promise((resolve, reject) => {
      if (this.failed) {
        reject(this.failed)
        return
      }
      try {
        this.engineProcess.stdin.write(cmd + '\n', 'utf-8', err => {
          if (err) reject(err)
          else resolve()
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  kill () {
    console.log('Sending TERM to game engine.')
    this.engineProcess.kill()
  }
}

class SocketEngine extends BaseEngine {
  constructor (socket, loggingEnabled) {
    super()
    this.socket = socket
    this.loggingEnabled = loggingEnabled
    this.onMessage = null
    this.bulkMode = false
    this.failed = null

    let stdoutData = []

    // ECONNREFUSED / reset etc.: fail fast + surface to the UI (dialog).
    this.socket.on('error', err => {
      this._fail(err, { notify: true })
    })
    // Peer closed: reject any in-flight request so the caller doesn't hang. No dialog — an
    // 'error' (above) precedes an abnormal close, and kill() also closes the socket.
    this.socket.on('close', () => {
      this._fail(new Error('Engine connection closed'), { notify: false })
    })

    this.socket.on('data', data => {
      data = data.toString()
      if (!data) {
        return
      }

      if (!data.endsWith('\n')) {
        stdoutData.push(data)
        return
      } else if (stdoutData.length) {
        stdoutData.push(data)
        data = stdoutData.join('')
        stdoutData = []
      }

      try {
        const response = JSON.parse(data)
        const hash = crypto.createHash('sha1').update(data).digest('hex')
        if (loggingEnabled) {
          console.debug(response)
        }
        if (this.onMessage) {
          const { resolve } = this.onMessage
          this.onMessage = null
          resolve({ response, hash })
        }
      } catch (e) {
        console.error('Received invalid json: ' + data)
        console.error(e)
        if (this.onMessage) {
          const { reject } = this.onMessage
          this.onMessage = null
          reject(e)
        }
      }
    })
  }

  on (type, cb) {
    if (type === 'exit') {
      this.socket.on('close', cb)
    } else if (type === 'error') {
      this.errHandler = cb
    }
  }

  _write (cmd) {
    return new Promise((resolve, reject) => {
      if (this.failed) {
        reject(this.failed)
        return
      }
      this.socket.write(cmd + '\n', 'utf-8', err => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  kill () {
    console.log('Closing socket')
    this.socket.destroy()
  }
}

export default ({ app }, inject) => {
  let spawnedEngine = null

  const appPath = window.process.argv.find(arg => arg.startsWith('--app-path=')).replace('--app-path=', '')
  const basePath = path.dirname(appPath)

  Vue.prototype.$engine = {
    // The engine artifact to run: an explicit override (a .jar or .js path), else the
    // single-file TypeScript engine bundle (jcz-engine.js) shipped with the app. A
    // host:port enginePath is handled earlier by isRemote().
    getEngineArtifact () {
      const { settings } = app.store.state
      if (settings.enginePath) {
        return settings.enginePath
      }
      // jcz-engine.js bundle: dev → project root (downloaded by download-game-engine.js);
      // packaged app → resources dir (bundled via builder.config extraResources)
      if (process.env.NODE_ENV === 'development') {
        return path.join(window.process.cwd(), 'jcz-engine.js')
      }
      return path.join(basePath, 'jcz-engine.js')
    },

    getEngineExecutable () {
      const { settings } = app.store.state
      const artifact = this.getEngineArtifact()
      // .js → Node. A packaged app can't assume the user has Node installed, so run the
      // bundled engine with Electron's own Node runtime (process.execPath, behaving as
      // Node via the ELECTRON_RUN_AS_NODE env set in spawn()).
      return process.env.NODE_ENV === 'development' ? 'node' : window.process.execPath
    },

    getEngineArgs () {
      const artifact = this.getEngineArtifact()
      return artifact.endsWith('.jar') ? ['-jar', artifact] : [artifact]
    },

    isRemote () {
      const { settings } = app.store.state
      const m = /^([.\w]+):(\d+)$/.exec(settings.enginePath)
      if (m) {
        return { port: parseInt(m[2]), host: m[1] }
      }
      return null
    },

    spawn ({ loggingEnabled }) {
      const remote = this.isRemote()
      if (remote) {
        const s = require('net').Socket()
        const engine = new SocketEngine(s, loggingEnabled)
        // Fail fast if the remote engine isn't listening / reachable, instead of hanging forever on
        // buffered writes to a socket that never connects.
        const REMOTE_CONNECT_TIMEOUT = 8000
        let connected = false
        const timer = setTimeout(() => {
          if (!connected) {
            engine._fail(new Error(`Can't connect to remote engine ${remote.host}:${remote.port}`), { notify: true })
            s.destroy()
          }
        }, REMOTE_CONNECT_TIMEOUT)
        s.once('connect', () => { connected = true; clearTimeout(timer); console.log('SocketEngine connected') })
        s.once('close', () => clearTimeout(timer))
        s.connect(remote.port, remote.host)
        spawnedEngine = engine
      } else {
        // run the engine bundle as a child process (.js → Node/Electron-as-Node)
        spawnedEngine = new Engine(spawn(this.getEngineExecutable(), this.getEngineArgs(), {
          // when the executable is Electron's binary, this makes it behave as plain Node
          env: { ...window.process.env, ELECTRON_RUN_AS_NODE: '1' }
        }), loggingEnabled)
      }
      spawnedEngine.on('exit', () => {
        spawnedEngine = null
      })
      return spawnedEngine
    },

    kill () {
      if (spawnedEngine) {
        spawnedEngine.kill()
        spawnedEngine = null
      }
    },

    get () {
      return spawnedEngine
    }
  }
}
