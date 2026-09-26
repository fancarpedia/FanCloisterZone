// Browser stub for `os`.
//
// webpack's os-browserify polyfill has no userInfo(), which store/settings.js calls to seed the
// default nickname:
//     if (!settings.nickname) settings.nickname = os.userInfo().username
//
// A browser has NO OS user, so username MUST be empty here — do not invent one. An empty nickname
// is what makes the app ask for it, exactly as the desktop build does:
//   * online.vue maybeAutoConnect() -> `if (!nickname || !nickname.trim()) return`  (stay offline)
//   * online.vue connect()          -> opens the nickname dialog, then connects
// Returning a placeholder like 'Player' silently skips that dialog and puts everyone on the server
// under the same name.
export const userInfo = () => ({ username: '' })

export const platform = () => 'web'
export const homedir = () => '/'
export const tmpdir = () => '/tmp'
export const EOL = '\n'
export default { userInfo, platform, homedir, tmpdir, EOL }
