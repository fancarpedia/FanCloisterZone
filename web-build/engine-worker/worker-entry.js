// Web Worker host for the TypeScript engine — the browser counterpart of the engine repo's
// src/main/ts/cli/jcz-engine.ts (which is a Node/stdio host).
//
// The engine core is deliberately Node-free: both of its host dependencies are injected.
//   * loadFile  -> Engine's constructor takes the XML reader. "%load <path>" resolves through it.
//   * DOMParser -> setDomParserFactory().
//
// GOTCHA: XmlUtils' default factory reads globalThis.DOMParser ("browser global by default"), but
// DOMParser is a WINDOW api — it does NOT exist in Web Worker scope. So we must inject a parser
// explicitly. @xmldom/xmldom is pure JS and bundles for the browser, exactly as the Node host uses.
import { Engine } from '@engine/engine/Engine.js'
import { setDomParserFactory } from '@engine/XmlUtils.js'
import { DOMParser } from '@xmldom/xmldom'
import XMLS from './xmls.generated.js'

setDomParserFactory(() => new DOMParser())

// The client sends absolute-ish paths ("%load .../xmls/basic.xml"); map them to the bundled text.
const loadFile = (p) => {
  const key = String(p).split(/[\\/]/).pop()
  const xml = XMLS[key]
  if (xml === undefined) throw new Error('unknown tile-definition XML: ' + key)
  return xml
}

let engine = new Engine(loadFile)

self.onmessage = (ev) => {
  const msg = ev.data || {}

  if (msg.type === 'reset') {
    engine = new Engine(loadFile) // a fresh engine == a fresh process
    return
  }

  if (msg.type !== 'line') return

  // Same line protocol as stdio: one command line in, at most one JSON state line out.
  try {
    const out = engine.processInput(msg.line)
    if (out !== null && out !== undefined) {
      self.postMessage({ type: 'stdout', data: out + '\n' })
    }
  } catch (e) {
    // '#'-prefixed == ignorable diagnostic, matching the Node host's stderr convention
    self.postMessage({ type: 'stderr', data: '#error ' + ((e && e.stack) || String(e)) })
  }
}

self.postMessage({ type: 'ready' })
