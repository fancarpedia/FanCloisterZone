const path = require('path')
const { defineConfig } = require('vitest/config')

// Mirrors the '@' -> src/renderer alias used by the Nuxt/webpack build (.electron-nuxt/config.js),
// so store/component modules can be imported in tests exactly as they are in the app.
module.exports = defineConfig({
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src', 'renderer')
    }
  },
  test: {
    include: ['src/renderer/**/*.spec.js']
  }
})
