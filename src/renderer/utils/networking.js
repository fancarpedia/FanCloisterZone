
export function connectExceptionToMessage (e) {
  if (e.error?.code === 'EAI_AGAIN') {
    return "Can't resolve host"
  }
  if (e.error?.code === 'ECONNREFUSED') {
    return 'Connection refused'
  }
  if (e.type === 'ERR' && e.payload) {
    return `${e.payload.code}: ${e.payload.message}`
  }
  // a WebSocket CloseEvent: the socket closed before the server welcomed us (server down,
  // restarting, or refusing the connection) — it has no message, only a close code / reason
  if (typeof e.code === 'number' && 'wasClean' in e) {
    return `Connection closed (code ${e.code}${e.reason ? ': ' + e.reason : ''})`
  }
  return e.message || 'Connection failed'
}
