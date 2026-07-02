import Vue from 'vue'
import { randomId, randomInt } from '@/utils/random'

import { getAppVersion } from '@/utils/version'
import { CONSOLE_CLIENT_COLOR } from '@/constants/logging'
import { NETWORK_PROTOCOL_COMPATIBILITY } from '@/constants/versions'
import { EventsBase } from '@/utils/events'

const isDev = process.env.NODE_ENV === 'development'
const HEARTBEAT_INTERVAL = 9 * 1000
const HEARTBEAT_TIMEOUT = 9 * 1000

class ConnectionPlugin extends EventsBase {
  constructor (app) {
    super()
    this.app = app
    this.ws = null
    this.recentlyUsedSourceHash = null
    this.pingTimeout = null
    this.pongTimeout = null

    this.callbacks = null
    this.connectCallbacks = null

    // React to the OS losing/regaining network. Dropping wifi does not promptly fire the
    // socket's own `onclose` (the TCP close handshake hangs with no network), so without this
    // the app would keep showing "connected" until connectivity returns. On `offline` we tear
    // the dead socket down at once so the store's reconnect loop takes over; on `online` we just
    // log — the reconnect loop is already retrying and will succeed on its next attempt.
    if (typeof window !== 'undefined') {
      this._onOffline = () => {
        // Only ONLINE (remote server) connections depend on internet connectivity. A local game's
        // embedded server runs on localhost and stays reachable while the OS is "offline" — never
        // tear a 'direct' connection down here, or creating/playing local games offline breaks.
        if (this.ws && this.app.store.state.networking.connectionType === 'online') {
          console.log('%c client %c network offline — dropping online connection', CONSOLE_CLIENT_COLOR, '')
          this.forceClose(4001)
        }
      }
      this._onOnline = () => {
        console.log('%c client %c network online', CONSOLE_CLIENT_COLOR, '')
        // Skip the reconnect backoff and retry straight away.
        this.app.store.dispatch('networking/reconnectNow')
      }
      window.addEventListener('offline', this._onOffline)
      window.addEventListener('online', this._onOnline)
    }

    if (process.env.JCZ_NETWORK_DELAY) {
      this.debugDelay = process.env.JCZ_NETWORK_DELAY.split('-').map(bound => +bound)
      if (this.debugDelay.length === 1) {
        // make interval from it
        this.debugDelay.push(this.debugDelay[0])
      }
    }
  }

  heartbeat = () => {
    clearTimeout(this.pingTimeout)
    clearTimeout(this.pongTimeout)

    this.pingTimeout = setTimeout(() => {
      this.pingTimeout = null
      if (this.ws?.readyState === 1) {
        this.ws.send('') // send empty frame = app level ping
        this.pongTimeout = setTimeout(() => {
          console.log('heartbeat timeout')
          // Don't rely on ws.close() here — on a dead network its close handshake hangs and
          // onclose never fires, leaving the app falsely "connected". Force the teardown.
          this.forceClose(4001)
        }, HEARTBEAT_TIMEOUT)
      }
    }, HEARTBEAT_INTERVAL)
  }

  onOpen () {
    console.log('%c client %c connected to ' + this.ws.url, CONSOLE_CLIENT_COLOR, '')
    const appVersion = getAppVersion()
    const engineVersion = this.app.store.state.engine.version
    const appSessionId = this.app.store.state.appSessionId
    const gameId = this.app.store.state.game ? this.app.store.state.game.id : null
    const { settings } = this.app.store.state
    this.ws.send(JSON.stringify({
      id: randomId(),
      type: 'HELLO',
      payload: {
        appVersion,
        engineVersion,
        protocolVersion: NETWORK_PROTOCOL_COMPATIBILITY,
        name: settings.nickname,
        clientId: settings.clientId,
        secret: settings.secret,
        appSessionId: appSessionId,
        language: settings.locale,
        // OS/system locale (e.g. "en-US"), independent of the in-app language setting above.
        systemLanguage: (typeof navigator !== 'undefined' && (navigator.language || (navigator.languages && navigator.languages[0]))) || null,
        gameId: gameId,
        platform: process.platform
      }
    }))
    this.heartbeat()
  }

  onMessage (ev) {
    this.heartbeat()
    if (ev.data === '') {
      if (isDev) {
        console.log('%c client %c received empty message (pong)', CONSOLE_CLIENT_COLOR, '')
      }
      return
    }

    const handle = () => {
      const msg = JSON.parse(ev.data)
      if (isDev) {
        console.log('%c client %c received message', CONSOLE_CLIENT_COLOR, '')
        console.debug(msg)
      }
      // console.debug(`%c client %c received ${msg.type}`, CONSOLE_CLIENT_COLOR, '')
      if (msg.type === 'ERR') {
        this.connectCallbacks?.reject(msg)
        this.emit('error', msg.payload)
        return
      }
      if (msg.type === 'WELCOME') {
        console.log('%c client %c session id assigned ' + msg.payload.sessionId, CONSOLE_CLIENT_COLOR, '')
        this.connectCallbacks?.resolve()
      }

      this.heartbeat()
      this.callbacks.onMessage(msg)
      this.emit('message', msg)
    }

    if (this.debugDelay) {
      setTimeout(() => {
        handle()
      }, randomInt(...this.debugDelay))
    } else {
      handle()
    }
  }

  // onError (err) {
  //   console.log(`%c client %c websocket error ${err.message}`, CONSOLE_CLIENT_COLOR, '')
  //   this.afterClose(4001, err)
  // }

  onClose (ev) {
    console.log(`%c client %c websocket closed  code: ${ev.code} reason: ${ev.reason}`, CONSOLE_CLIENT_COLOR, '')
    this.afterClose(this.connectCallbacks ? 1000 : ev.code, ev) // not connected yet, do not report 1006
  }

  afterClose (code, ev) {
    clearTimeout(this.pingTimeout)
    clearTimeout(this.pongTimeout)
    if (this.ws) {
      this.connectCallbacks?.reject(ev)
      this.emit('close', ev)

      this.callbacks?.onClose(code)
      this.callbacks = null
      this.ws = null
    }
  }

  // Give up on the current socket *now* and notify the app (→ store reconnect loop), without
  // waiting for the WebSocket close handshake — which can hang for minutes when the network has
  // silently disappeared. Used by the heartbeat timeout and the OS `offline` event.
  forceClose (code) {
    const ws = this.ws
    if (!ws) return
    // Detach handlers first so this socket's own (possibly long-delayed) onclose can't later
    // fire against a freshly reconnected socket and tear it down.
    ws.onopen = null
    ws.onmessage = null
    ws.onclose = null
    this.afterClose(code, { code }) // nulls this.ws + invokes callbacks.onClose(code) → reconnect
    try {
      ws.close(code) // best effort; the network may already be gone
    } catch (e) {
      // ignore
    }
  }

  terminate () {
    // close has 30 sec timeout, remove listeners and call onClose immediatelly
    if (this.ws) {
      this.ws.onpen = undefined
      this.ws.onmessage = undefined
      this.ws.onclose = undefined
      this.ws.close(4001)
      this.onClose(4001, null)
    }
  }

  // TODO use emitter instead callback
  async connect (host, { onMessage, onClose }) {
    this.callbacks = { onMessage, onClose }

    return new Promise((resolve, reject) => {
      console.log('%c client %c trying to connect to ' + host, CONSOLE_CLIENT_COLOR, '')

      this.connectCallbacks = {
        resolve: () => { this.connectCallbacks = null; resolve() },
        reject: err => { this.connectCallbacks = null; reject(err) }
      }

      this.ws = new WebSocket(host)
      this.ws.onopen = this.onOpen.bind(this)
      this.ws.onmessage = this.onMessage.bind(this)
      this.ws.onclose = this.onClose.bind(this)
    })
  }

  disconnect () {
    if (this.ws) {
      // Deliberate disconnect: detach handlers and drop the socket reference *before* closing.
      // The plugin keeps a single `this.ws`, so if we reconnect right away (e.g. switching servers)
      // the old socket's late `onclose` would otherwise fire against the NEW socket and tear it down.
      const ws = this.ws
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      this.ws = null
      this.callbacks = null
      this.recentlyUsedSourceHash = null
      clearTimeout(this.pingTimeout)
      clearTimeout(this.pongTimeout)
      ws.close()
    }
  }

  send (message) {
    return new Promise((resolve, reject) => {
      // ignored messages when client is disconnected
      if (this.ws) {
        if (message.sourceHash) {
          if (message.sourceHash === this.recentlyUsedSourceHash) {
            // duplicate message
            return resolve()
          }

          // set protection for next 1s => do not send message with same origin during this time
          this.recentlyUsedSourceHash = message.sourceHash
          setTimeout(() => {
            if (this.recentlyUsedSourceHash === message.sourceHash) {
              this.recentlyUsedSourceHash = null
            }
          }, 1000)
        }
        if (!message.id) {
          message = { id: randomId(), ...message }
        }

        if (this.debugDelay) {
          setTimeout(() => {
            this.ws.send(JSON.stringify(message))
            resolve()
          }, randomInt(...this.debugDelay))
        } else {
          this.ws.send(JSON.stringify(message))
          resolve()
        }
      } else {
        resolve()
      }
    })
  }

  // isConnectedOrConnecting () {
  //   return this.ws !== null
  // }

  onNextSendError (handler) {
    const callbacks = {}
    callbacks.onError = err => {
      this.off('error', callbacks.onError)
      this.off('message', callbacks.onMessage)
      handler(err)
    }
    callbacks.onMessage = () => {
      this.off('error', callbacks.onError)
      this.off('message', callbacks.onMessage)
    }
    this.on('error', callbacks.onError)
    this.on('message', callbacks.onMessage)
  }
}

export default ({ app }, inject) => {
  Vue.prototype.$connection = new ConnectionPlugin(app)
}
