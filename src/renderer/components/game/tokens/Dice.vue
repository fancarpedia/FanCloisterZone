<template>
    <svg viewBox="0 0 120 120">
      <rect width="120" height="120" fill="white" />
      <circle v-if="this.value === 1 || this.value === 3 || this.value === 5" cx="60" cy="60" r="12" />
      <circle v-if="this.value === 3 || this.value === 4 || this.value === 5 || this.value === 6" cx="90" cy="30" r="12" />
      <circle v-if="this.value === 3 || this.value === 4 || this.value === 5 || this.value === 6" cx="30" cy="90" r="12" />
      <circle v-if="this.value === 4 || this.value === 5 || this.value === 6" cx="90" cy="90" r="12" />
      <circle v-if="this.value === 4 || this.value === 5 || this.value === 6" cx="30" cy="30" r="12" />
      <circle v-if="this.value === 6" cx="60" cy="90" r="12" />
      <circle v-if="this.value === 6" cx="60" cy="30" r="12" />
      <circle v-if="this.value === 2" cx="40" cy="80" r="12" />
      <circle v-if="this.value === 2" cx="80" cy="40" r="12" />
    </svg>
</template>

<script>
export default {
  props: {
    value: { type: Number, required: true }
  }
}
</script>

<style lang="sass" scoped>
svg
  border-radius: 5px
  border: 1px solid #aaaaaa  
</style>