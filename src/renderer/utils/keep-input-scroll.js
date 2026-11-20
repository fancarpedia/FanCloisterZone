// v-keep-input-scroll — a one-line text input keeps showing the part of a long text it showed
// while typing (its end) after it loses focus, instead of the browser's jump back to the start.
//
// Browsers reset an <input>'s horizontal scroll to 0 on blur: type a long chat message, click the
// board to play part of the turn, and the field shows the beginning; click back and the caret
// lands somewhere at the start. On blur the scroll position and caret are remembered and the
// scroll is put back; a later focus that is not a click (Tab, focus from code) also gets the
// caret back — a click places the caret where it lands in the (now unchanged) visible text.
//
// Works on a plain <input> or on any wrapper containing one (e.g. Vuetify's v-text-field).

const STATE = Symbol('keepInputScroll')

const findInput = el => (el.tagName === 'INPUT' ? el : el.querySelector('input'))

export default {
  inserted (el) {
    const input = findInput(el)
    if (!input) return
    const st = { scroll: 0, start: null, end: null, mouse: false }

    st.onBlur = () => {
      st.scroll = input.scrollLeft
      st.start = input.selectionStart
      st.end = input.selectionEnd
      // the browser resets the scroll right after blur — put it back once it has
      requestAnimationFrame(() => { input.scrollLeft = st.scroll })
    }
    st.onMouseDown = () => { st.mouse = true }
    st.onFocus = () => {
      const byMouse = st.mouse
      st.mouse = false
      if (byMouse || st.start === null) return
      const len = input.value.length
      requestAnimationFrame(() => {
        input.setSelectionRange(Math.min(st.start, len), Math.min(st.end, len))
        input.scrollLeft = st.scroll
      })
    }

    input.addEventListener('blur', st.onBlur)
    input.addEventListener('mousedown', st.onMouseDown)
    input.addEventListener('focus', st.onFocus)
    el[STATE] = { input, st }
  },

  unbind (el) {
    const saved = el[STATE]
    if (!saved) return
    const { input, st } = saved
    input.removeEventListener('blur', st.onBlur)
    input.removeEventListener('mousedown', st.onMouseDown)
    input.removeEventListener('focus', st.onFocus)
    delete el[STATE]
  }
}
