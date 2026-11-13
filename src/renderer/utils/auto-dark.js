// A browser's automatic dark mode (e.g. Chrome's "Auto Dark Mode for Web Contents") repaints the
// page itself: it darkens light backgrounds and turns dark text light. The scoring bullets of the
// light player colours (yellow, orange, white) carry black text on purpose, and came out white
// under it. Detect the forced darkening so those bullets can opt out (player-colors.scss).

// Forced darkening repaints even the system Canvas colour of an element that asks for the normal
// (light) scheme — a light page shows it white, a force-darkened one dark.
export function isAutoDarkActive () {
  if (typeof document === 'undefined' || !document.body) return false
  const d = document.createElement('div')
  d.style.cssText = 'color-scheme: normal; background: Canvas; position: absolute; visibility: hidden'
  document.body.appendChild(d)
  const bg = getComputedStyle(d).backgroundColor
  d.remove()
  const parts = (bg || '').match(/\d+/g)
  if (!parts || parts.length < 3) return false
  // light canvas is rgb(255, 255, 255); dark means forced darkening
  const [r, g, b] = parts.map(Number)
  return (r + g + b) / 3 < 128
}

// put `auto-dark` on <html> while the browser force-darkens the page
export function markAutoDark () {
  const active = isAutoDarkActive()
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('auto-dark', active)
  }
  return active
}
