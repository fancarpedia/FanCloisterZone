export function getAppVersion () {
  if (process.env.NODE_ENV === 'development') {
    return process.env.npm_package_version
  }
  return window.process.argv.find(arg => arg.startsWith('--app-version=')).replace('--app-version=', '')
}

// Alpha build = pre-release version ("6.3.0-alpha.13") or the dedicated alpha channel.
// Used to visibly mark alpha instances (window title, splash badge, taskbar overlay).
export function isAlphaBuild () {
  try {
    return getAppVersion().includes('alpha')
  } catch (e) {
    return false
  }
}
