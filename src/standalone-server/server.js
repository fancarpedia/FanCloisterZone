import GameServer from './server.js'

const game = {
  gameId: '1',
  setup: {
    sets: { 'basic:1': 1 },
    elements: { 'small-follower': 7, 'farmers': true },
    rules: { 'tiny-city-scoring': '4' },
    timer: null,
    start: [{ tile: 'BA/RCr', x: 0, y: 0, rotation: 0 }],
    options: {}
  },
  slots: [
    { number: 0, clientId: null, sessionId: null, name: null, ai: false },
    { number: 1, clientId: null, sessionId: null, name: null, ai: false },
    { number: 2, clientId: null, sessionId: null, name: null, ai: false },
    { number: 3, clientId: null, sessionId: null, name: null, ai: false },
    { number: 4, clientId: null, sessionId: null, name: null, ai: false },
    { number: 5, clientId: null, sessionId: null, name: null, ai: false },
    { number: 6, clientId: null, sessionId: null, name: null, ai: false },
    { number: 7, clientId: null, sessionId: null, name: null, ai: false },
    { number: 8, clientId: null, sessionId: null, name: null, ai: false }
  ],
  gameAnnotations: {}
}

const engineVersion = process.argv[process.argv.length - 1]
const port = 37447

console.log(`Starting standalone server on port ${port}. Accepted engine version is ${engineVersion}`)

const gameServer = new GameServer(game, null, {
  appVersion: process.env.npm_package_version,
  engineVersion: process.argv[process.argv.length - 1]
})
gameServer.start(port)
