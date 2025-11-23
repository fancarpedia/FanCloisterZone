/**
 * By default, Nuxt.js is configured to cover most use cases.
 * This default configuration can be overwritten in this file
 * @link {https://nuxtjs.org/guide/configuration/}
 */
 
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

module.exports = {
  ssr: false,
  head: {
    title: 'FanCloisterZone Edition', /* Fan Edition */
    meta: [
      { charset: 'utf-8' }
    ]
  },
  loading: false,
  plugins: [
    // '~/plugins/portal-vue',
    '~/plugins/engine',
    '~/plugins/server',
    '~/plugins/connection',
    '~/plugins/addons',
    '~/plugins/tiles',
    '~/plugins/theme',
    { ssr: true, src: '@/plugins/icons.js' },
    '~/plugins/router-patch',
    '~/plugins/date-format',
    '~/plugins/i18n.js',
    '~/plugins/vuei18n.js'
  ],
  buildModules: [
    '@nuxtjs/style-resources'
  ],
  modules: [
    '@nuxtjs/vuetify',
    '@nuxtjs/i18n'
  ],

  styleResources: {
    sass: './assets/styles/shared.sass'
  },

  i18n: {
    vueI18n: '~/plugins/vuei18n.js',
    strategy: 'no_prefix',
    detectBrowserLanguage: false,
    locales: [
      {
        code: 'ca',
        file: 'ca.json'
      },
      {
        code: 'cs',
        file: 'cs.json'
      },
      {
        code: 'de',
        file: 'de.json'
      },
      {
        code: 'en',
        file: 'en.json'
      },
      {
        code: 'es',
        file: 'es.json'
      },
      {
        code: 'fr',
        file: 'fr.json'
      },
      {
        code: 'lt',
        file: 'lt.json'
      },
      {
        code: 'nl',
        file: 'nl.json'
      },
      {
        code: 'pl',
        file: 'pl.json'
      },
      {
        code: 'ro',
        file: 'ro.json'
      },
      {
        code: 'ru',
        file: 'ru.json'
      },
      {
        code: 'sk',
        file: 'sk.json'
      },
      {
        code: 'sl',
        file: 'sl.json'
      }
    ],
    // lazy: true,
    langDir: 'locales/',
    defaultLocale: 'en'
  },

  vuetify: {
    // https://medium.com/untitled-factory/changing-default-font-in-vuetify-js-and-nuxt-js-3894e726ff10
    // uncomment to change font
    // customVariables: ['~/assets/variables.scss'],
    // treeShake: true,

    defaultAssets: {
      font: false,
      icons: 'fa'
    },

    theme: {
      options: { customProperties: true },
      themes: {
        light: {
          primary: '#5dc4ff' // /* Fan Edition */
        },
        dark: {
          primary: '#148bd0' // /* Fan Edition */
        }
      }
    }
  },

  build: {
    loaders: {
      vue: {
        transformAssetUrls: {
          audio: 'src'
        }
      }
    },

    extend (config, ctx) {
      config.module.rules.push({
        test: /\.(ogg|mp3|wav|mpe?g)$/i,
        loader: 'file-loader',
        options: {
          name: '[path][name].[ext]'
        }
      })

      config.module.rules.push({
        test: /\.ohm$/i,
        loader: 'raw-loader'
      })

      // https://github.com/yan-foto/electron-reload/issues/71
      config.externals = {
        fsevents: "require('fsevents')"
      }
      const babelRequiredPaths = [
        path.resolve(require.resolve('megajs'), '..', '..'),
        path.resolve(require.resolve('fs-extra'), '..', '..')
      ]
      config.module.rules.push({
        test: /\.js$/,
        include: babelRequiredPaths, // only transpile to requested paths
        use: {
          loader: 'babel-loader',
            options: {
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: '16'
          },
          modules: 'commonjs'
        }]
      ],
      plugins: [
        '@babel/plugin-proposal-nullish-coalescing-operator',
        '@babel/plugin-proposal-optional-chaining'
      ]
          }
        }
      })
    }
  },
  
  watch: isDev ? [
  	path.resolve(__dirname, 'src/render/store/board.js'),
  	path.resolve(__dirname, 'src/render/store/game.js'),
  	path.resolve(__dirname, 'src/render/store/gameSetup.js'),
  	path.resolve(__dirname, 'src/render/store/index.js'),
  	path.resolve(__dirname, 'src/render/store/networking.js'),
  	path.resolve(__dirname, 'src/render/store/online.js'),
  	path.resolve(__dirname, 'src/render/store/settings.js')
  ] : []
}
