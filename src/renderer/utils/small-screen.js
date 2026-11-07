import Vue from 'vue'

// Keep in step with $small-screen-max-width in assets/styles/shared.sass, and with the media
// queries in ActionPanel/game.vue that lay the action bar out for narrow screens.
export const SMALL_SCREEN_QUERY = '(max-width: 960px)'

// One matchMedia for the whole app, made reactive so any component can just read it. matchMedia
// fires only when the breakpoint is actually crossed, unlike a resize listener that would run on
// every pixel of a drag.
const state = Vue.observable({ small: false })

let mql = null
if (typeof window !== 'undefined' && window.matchMedia) {
  mql = window.matchMedia(SMALL_SCREEN_QUERY)
  state.small = mql.matches
  const onChange = ev => { state.small = ev.matches }
  if (mql.addEventListener) {
    mql.addEventListener('change', onChange)
  } else {
    mql.addListener(onChange) // older Safari
  }
}

export const isSmallScreen = () => state.small

// test seam: there is no matchMedia under vitest, and jsdom cannot resize anyway
export const setSmallScreenForTest = value => { state.small = value }
