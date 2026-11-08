import Vue from 'vue'

// Keep in step with $small-screen-max-width in assets/styles/shared.sass, and with the media
// queries in ActionPanel/game.vue that lay the action bar out for narrow screens.
export const SMALL_SCREEN_QUERY = '(max-width: 960px)'

// One matchMedia for the whole app, made reactive so any component can just read it. matchMedia
// fires only when the breakpoint is actually crossed, unlike a resize listener that would run on
// every pixel of a drag.
const state = Vue.observable({ small: false })

let mql = null
let onChange = null
if (typeof window !== 'undefined' && window.matchMedia) {
  mql = window.matchMedia(SMALL_SCREEN_QUERY)
  state.small = mql.matches
  onChange = ev => { state.small = ev.matches }
  if (mql.addEventListener) {
    mql.addEventListener('change', onChange)
  } else {
    mql.addListener(onChange) // older Safari
  }
}

// This module subscribes at import time, so a hot swap would leave the previous listener behind -
// writing to a `state` nothing reads any more, one more each time the file is touched. A full
// reload does not need this (fresh context), but HMR does.
// `module` exists under webpack; guard it so importing this file anywhere else (a test run,
// for instance) does not throw a ReferenceError before the first line of the test.
if (typeof module !== 'undefined' && module.hot) {
  module.hot.dispose(() => {
    if (!mql || !onChange) return
    if (mql.removeEventListener) {
      mql.removeEventListener('change', onChange)
    } else {
      mql.removeListener(onChange)
    }
  })
}

export const isSmallScreen = () => state.small

// test seam: there is no matchMedia under vitest, and jsdom cannot resize anyway
export const setSmallScreenForTest = value => { state.small = value }
