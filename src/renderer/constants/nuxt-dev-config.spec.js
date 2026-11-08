import { describe, it, expect, afterEach } from 'vitest'

// Nuxt emits <link rel="preload"> from the client manifest. In dev that manifest picks up the
// incremental *.hot-update.js chunks, so every page load preloaded files the HMR runtime never
// asks for on a cold start - the browser fetched them and then warned "preloaded using link
// preload but not used", on every forced reload. Dev drops the hints; production keeps them.
const CONFIG = '@/nuxt.config.js'

const loadWith = async env => {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = env
  try {
    const mod = await import(/* @vite-ignore */ CONFIG + '?env=' + env)
    return mod.default || mod
  } finally {
    process.env.NODE_ENV = previous
  }
}

let restore
afterEach(() => { if (restore) restore() })

describe('resource hints', () => {
  it('are off in dev, where they only point at hot-update chunks', async () => {
    const config = await loadWith('development')
    expect(config.render).toEqual({ resourceHints: false })
  })

  it('are left alone in production, where preloading is wanted', async () => {
    const config = await loadWith('production')
    expect(config.render.resourceHints).toBeUndefined()
  })
})
