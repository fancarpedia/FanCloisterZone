// The operating system's locale (e.g. "sk-SK"), sent to the server in HELLO next to the in-app
// language and the browser language.
//
// The desktop app gets it from Electron's app.getSystemLocale() with the settings (store
// settings.loaded keeps it here). Before that arrives, and in the web build where there is no OS
// to ask, the browser's own resolved locale stands in.

let systemLocale = null

export const setSystemLocale = value => {
  systemLocale = value || null
}

export const getSystemLocale = () => {
  if (systemLocale) return systemLocale
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || null
  } catch (e) {
    return null
  }
}
