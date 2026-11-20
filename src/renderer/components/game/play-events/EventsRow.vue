<template>
  <div
    class="events-row"
    :class="{ final }"
  >
    <div v-if="row.title" class="events-row-title">{{ row.title }}</div>
    <div class="events-row-events">
      <PlayEvent
        v-for="(ev, i) in row.events"
        :key="i"
        :ev="ev"
        :player="player"
        :siblings="row.turnEvents || row.events"
      />
    </div>
  </div>
</template>

<script>
import PlayEvent from '@/components/game/play-events/PlayEvent'

export default {
  components: {
    PlayEvent
  },

  props: {
    row: { type: Object, required: true },
    player: { type: Number, default: null },
    final: { type: Boolean }
  }
}
</script>

<style lang="sass" scoped>
.events-row
  position: absolute
  left: 11px
  border-right: 1px solid rgba(192, 192, 192, 0.2)
  overflow: hidden

  &.final
    position: static
    border-right: 0

.events-row-title
  font-size: 11px
  text-transform: uppercase
  margin: 2px 0

.events-row-events
  display: flex

// final scoring: the Big Top's revealed animal token sits among the score bullets — sized like
// them (not the 41px square of a regular play event), on the same line
.events-row.final ::v-deep .play-event.ev-token-placed
  height: auto
  min-width: 0
  padding: 0 3px
  align-self: center

.collapsed .events-row
  width: 0

  &.final
    width: auto
</style>
