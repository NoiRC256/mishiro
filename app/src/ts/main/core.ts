import configurer from './config'
import * as core from 'mishiro-core'
import * as Updater from 'electron-github-asar-updater'

const { setCache } = __non_webpack_require__('./export.js')

const updater = new Updater('toyobayashi/mishiro', 'resources')

setCache('mishiroCore', core)

const config = configurer.getConfig()

const confver = config.latestResVer
const confacc = config.account

setCache('client', new core.Client(
  confacc || '::',
  confver !== undefined ? (confver/*  - 100 */).toString() : undefined
))

setCache('updater', updater)

export * from 'mishiro-core'
