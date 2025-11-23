# FanCloisterZone Edition

Updated original JCloisterZone with many improvements.
Also support of many fan-expansions, chat during game, lobby.
All issues on FanCloisterZone report on [Discord](https://discord.gg/3qpHWN8k)

## Supported Fan Expansions
* [City Gates, The](https://wikicarpedia.com/car/The_City_Gates_(1st_edition))
* [Decinsky Sneznik](https://wikicarpedia.com/car/D%C4%9B%C4%8D%C3%ADnsk%C3%BD_Sn%C4%9B%C5%BEn%C3%ADk_(Fan_Expansion))
* [Family Feud](https://wikicarpedia.com/car/Family_Feud_(Fan_Expansion))
* [Flying Machines 2, The](https://wikicarpedia.com/car/The_Flying_Machines_2_(Fan_Expansion))
* [Labyrinths, The](https://wikicarpedia.com/car/The_Labyrinths_(Fan_Expansion))
* [Meteorites](https://wikicarpedia.com/car/Meteorites_(Fan_Expansion))
* [Obelisk, The](https://wikicarpedia.com/car/The_Obelisk_(Fan_Expansion))
* [Robber's Son](https://wikicarpedia.com/car/Robber%27s_Son_(Fan_Expansion))
* [Village Life](https://wikicarpedia.com/car/Village_Life_(Fan_Expansion))
* [Wells, The](https://wikicarpedia.com/car/The_Wells_(Fan_Expansion))

## Engine

Engine for game can be found on https://github.com/fancarpedia/JCloisterZoneEngine


## I want to help

There is several options how you halp help this open-source project. You can ask on our [Discord](https://discord.gg/3qpHWN8k)

### How I can help
* Better UI
* Better AI/Bot answers / quicker response
* Creating addons for new fan expansions - tile shapes and/or game mechanics
* Testing

### Run your own installation for DEV

#### Build Setup

``` bash
# install dependencies
yarn install

# serve app with hot reload
yarn run dev

# build electron application for production
yarn run package

# lint all JS/Vue component files in `src/`
yarn run lint
```

## Engine for local dev

Engine.jar is not included in repository. Download latest with

``` bash
yarn download-game-engine
```

## Run client against remote engine

Another option is running against dev version of engine.
Run engine listening to socket. It will be usualy started using Java IDE.
Add program args to run configuration

```
java -Dorg.slf4j.simpleLogger.log.AIRanking=debug -ea -jar build\Engine.jar -port 9001
```

Add engine's socket address to jcz-config.json (you can find location in Main menu / Help / About)
```
"enginePath": "localhost:9001",
```

### Run second client with different config in dev

```
JCZ_CONFIG=/home/user/.config/Electron/jcz-config-2.json JCZ_NETWORK_DELAY=1-50 yarn dev
```

## Special downgrades
Envoronment requires node 16, yarn 1, java 17

### On Mac
```
corepack disable
npm uninstall -g yarn
npm install -g yarn@1
xcode-select --install
yarn --version
```

### Every Operating Systems
Check if version is 1.22.x
```
nvm install 16
nvm use 16
node --version
```
Check if version is 16.x.x 

### Update package.json (macOS)
Add package manager witch current yarn version
```
  "packageManager": "yarn@1.22.22"
```

## Cookbook

### Add new language

* Add plural settings
`src/renderer/plugins/vuei18n.js`

* Add flag
`src/renderer/assets/flags.svg`

* Define new language
`src/renderer/constants/locales.js`

* Add new locale files
`src/renderer/locales/`

* Define new language for compile
`src/renferer/nuxt.config.js`

### Use translated texts in Vue
#### Usage in <template>

#### Usage in <script>

### Add package failed with Webpack 4 or Node 16 (by use babe this.config?.something or this.value ?? failvervalue

* Append file to `babelRequiredFiles` in `src/renderer/nuxt.config.js` as example for `megajs`
  ```
  const babelRequiredPaths = [
    path.resolve(require.resolve('megajs'), '..', '..')
  ]
  ```
### Prepare build 

#### Load all locales
  `yarn locale-updates`

#### Try to build to test installation
  `yarn build`

#### Update package.json for current app version

#### Github stuff for create a release
  `git push`
  `git tag -a RELEASE`
  `git push origin RELEASE`
