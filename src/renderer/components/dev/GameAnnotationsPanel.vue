<template>
  <div class="annotations-panel">
    <h5>Development Panel</h5>
    <div class="annotations-panel-content">
      <div class="draw-order">
        <h6>Draw Order</h6>
        <i>
          Click on tiles above to select draw order.
        </i>
        <div class="draw-order-tiles">
          <!-- each entry with an x to take just that one out of the order -->
          <div
            v-for="(id, idx) in drawOrder"
            :key="idx"
            class="draw-order-tile"
          >
            <StandaloneTileImage :tile-id="id" :size="40" />
            <!-- swap with the neighbour on the left / right -->
            <div class="move">
              <button type="button" title="Move left" :disabled="idx === 0" @click="moveTile(idx, -1)">
                <v-icon x-small>fas fa-chevron-left</v-icon>
              </button>
              <button type="button" title="Move right" :disabled="idx === drawOrder.length - 1" @click="moveTile(idx, 1)">
                <v-icon x-small>fas fa-chevron-right</v-icon>
              </button>
            </div>
            <button
              type="button"
              class="remove"
              title="Remove from draw order"
              @click="removeTile(idx)"
            >
              <v-icon x-small>fas fa-times</v-icon>
            </button>
          </div>
        </div>
        <div>
          <v-btn text @click="drawOrder = []">Clear</v-btn>
        </div>
      </div>
      <div>
        <h6>Premature end</h6>
        <i>
          Limits number of tiles after game will be ended.
          Useful for final scoring testing.
        </i>
        <v-text-field
          v-model="limitPackSize"
          label="Game Turns Limit"
        />
      </div>
    </div>
  </div>
</template>

<script>
import StandaloneTileImage from '@/components/game/StandaloneTileImage'

export default {
  components: {
    StandaloneTileImage
  },

  // starts from the stored annotations: coming back to the setup ("Change" on the open game page,
  // or the panel shown again) must not drop a draw order that was already set
  data () {
    const stored = this.$store.state.gameSetup.gameAnnotations || {}
    return {
      limitPackSize: stored.endTurn ? String(stored.endTurn) : '',
      drawOrder: [...(stored.drawOrder || [])],
      visible: false
    }
  },

  computed: {
    annotations () {
      const annotations = {}
      if (this.drawOrder.length) {
        annotations.drawOrder = [...this.drawOrder]
      }
      if (this.limitPackSize) {
        annotations.endTurn = parseInt(this.limitPackSize)
      }
      return annotations
    }
  },

  watch: {
    annotations (val) {
      this.$store.commit('gameSetup/gameAnnotations', val)
    }
  },

  methods: {
    // swap the tile at idx with its neighbour (dir -1 = left, +1 = right)
    moveTile (idx, dir) {
      const j = idx + dir
      if (j < 0 || j >= this.drawOrder.length) return
      const order = [...this.drawOrder]
      ;[order[idx], order[j]] = [order[j], order[idx]]
      this.drawOrder = order
    },

    removeTile (idx) {
      this.drawOrder.splice(idx, 1)
    },

    appendTile (tileId, maxCount) {
      if (this.drawOrder.filter(item => item === tileId).length < maxCount) {
        this.drawOrder.push(tileId)
      }
    }
  }
}
</script>

<style lang="sass" scoped>
.annotations-panel
  margin-top: 20px
  min-height: 200px
  border: 1px solid #AD1457

  .annotations-panel-content
    margin: 20px

  h5
    padding: 6px 0
    text-align: center
    background-color: #AD1457
    color: white
    text-transform: uppercase

  h6
    font-weight: 300
    font-size: 16px
    text-transform: uppercase
    margin-top: 20px

    +theme using ($theme)
       color: map-get($theme, 'gray-text-color')

  i
    display: block
    font-size: 11px
    line-height: 1.2
    margin: 5px 0

  .draw-order
    margin-top: 20px

  .draw-order-tiles
    display: flex
    flex-wrap: wrap
    gap: 4px

  .draw-order-tile
    position: relative

    svg
      display: block

    // ◀ ▶ under the tile
    .move
      display: flex
      justify-content: space-between

      button
        flex: 1
        height: 16px
        display: flex
        align-items: center
        justify-content: center
        padding: 0
        cursor: pointer

        .v-icon
          font-size: 9px !important

        &:hover:not(:disabled)
          background: rgba(173, 20, 87, 0.15)

        &:disabled
          opacity: 0.25
          cursor: default

    // the x in the tile's top-right corner
    .remove
      position: absolute
      top: -6px
      right: -6px
      width: 18px
      height: 18px
      display: flex
      align-items: center
      justify-content: center
      border-radius: 50%
      padding: 0
      cursor: pointer
      background: #AD1457
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4)

      .v-icon
        color: white
        font-size: 10px !important

      &:hover
        filter: brightness(1.15)
</style>
