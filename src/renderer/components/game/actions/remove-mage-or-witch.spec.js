import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// Giving up the mage or the witch (their features joined and no open city/road is left) is drawn
// like the abbot return: each figure big in a round action slot with the return icon over it.
const DIR = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.join(DIR, 'RemoveMageOrWitchAction.vue'), 'utf8').split(String.fromCharCode(13)).join('')

describe('RemoveMageOrWitchAction', () => {
  it('draws each offered figure in an action slot with the return icon, like the abbot', () => {
    expect(src).toContain('v-for="fig in figures"')
    expect(src).toContain('class="action-item"')
    expect(src).toContain('<v-icon class="color-overlay">fas fa-undo</v-icon>')
    expect(src).not.toContain('<v-btn')
  })

  it('takes the figures from the engine action and removes the clicked one (to: null)', () => {
    expect(src).toContain("(this.action.items || []).find(i => i.type === 'RemoveMageOrWitch')")
    expect(src).toContain("type: 'MOVE_NEUTRAL_FIGURE'")
    expect(src).toContain('to: null')
  })

  it('shows the figures greyed out to the other players', () => {
    expect(src).toContain(':class="{ inactive: !local }"')
  })
})

describe('removing the mage or witch on the board', () => {
  const layer = fs.readFileSync(path.join(DIR, '../layers/MeepleLayer.vue'), 'utf8').split(String.fromCharCode(13)).join('')

  it('the action puts up the NeutralFigureSelectLayer with the offered figures and listens for a click', () => {
    expect(src).toContain('mixins: [LayeredItemMixin]')
    expect(src).toContain("return [['NeutralFigureSelectLayer', {")
    expect(src).toContain("this.$root.$on('neutral-figure.select', this.select)")
    expect(src).toContain("this.$root.$off('neutral-figure.select', this.select)")
  })

  it('MeepleLayer circles each offered figure in the player colour and emits the click', () => {
    expect(layer).toContain('neutralSelect: state => state.board.layers.NeutralFigureSelectLayer,')
    expect(layer).toContain('v-if="neutralSelectable(n.type)"')
    expect(layer).toContain("this.$root.$emit('neutral-figure.select', figureId)")
    expect(layer).toContain('@click="ev => neutralSelect.local && onNeutralSelect(ev, neutralSelectable(n.type))"')
  })
})

describe('the board circle matches the abbot return style', () => {
  const layer = fs.readFileSync(path.join(DIR, '../layers/MeepleLayer.vue'), 'utf8').split(String.fromCharCode(13)).join('')
  const block = layer.slice(layer.indexOf('v-if="neutralSelectable(n.type)"'))

  it('uses the shared meeple-select class (half-transparent, full on hover)', () => {
    expect(block.slice(0, 200)).toContain(":class=\"['meeple-select', colorCssClass(neutralSelect.player)]\"")
    expect(block).toContain(":class=\"{'color-stroke': true, mouseover: mouseOver === neutralSelectable(n.type) }\"")
  })

  it('has the meeple circle size and stroke', () => {
    expect(block.slice(0, 600)).toContain(':r="BASE_SIZE * 0.27"')
    expect(block.slice(0, 600)).toContain(':stroke-width="BASE_SIZE * 0.07"')
  })
})
