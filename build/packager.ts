import * as unzip from 'unzip'
import rcedit = require('rcedit')
import * as fs from 'fs'
import * as path from 'path'
import { slog, log, ilog, wlog, elog } from './rainbow'
import { copy, remove } from '../src/ts/common/fse'
import request, { RequestOption, ProgressInfo } from '../src/ts/common/request'
const packageJson = require('../package.json')

function downloadElectronRelease (electronUrl: string, electronPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const PROGRESS_LENGTH = 50
    let options: RequestOption = {
      url: electronUrl,
      path: electronPath,
      onData: (prog: ProgressInfo) => {
        const PERCENT = prog.loading / 100
        const COMPLETED_LENGTH = Math.floor(PROGRESS_LENGTH * PERCENT)
        const PROGRESS_BAR = `[${repeat('=', COMPLETED_LENGTH - 1)}>${repeat(' ', PROGRESS_LENGTH - COMPLETED_LENGTH)}] `
        slog(PROGRESS_BAR + (100 * PERCENT).toFixed(2) + '%')
      }
    }

    let req = request(options, (err: Error, _body: string, path: string) => {
      if (!err) {
        ilog(`\n[INFO ${t()}] Download completed.`)
        resolve()
      } else reject(err)
    })
  })

  function repeat (char, l) {
    l = l < 0 ? 0 : l
    return Array.from({ length: l }, (v, k) => char).join('')
  }
}

function unzipElectron (electronPath, distPath) {
  return new Promise(resolve => {
    let readStream = fs.createReadStream(electronPath)
    let writeStream = unzip.Extract({ path: distPath })
    readStream.pipe(writeStream)
    writeStream.on('close', () => {
      resolve(distPath)
    })
  })
}

function changeExeInfo (exePath, option) {
  return new Promise((resolve, reject) => {
    rcedit(exePath, option, err => {
      if (err) reject(err)
      else resolve(true)
    })
  })
}

function t () {
  return new Date().toLocaleString()
}

function pack (option) {
  const PLATFORM = option.platform ? option.platform : 'win32'
  const ARCH = option.arch ? option.arch : 'ia32'
  const ELECTRON_VERSION = option.electronVersion ? option.electronVersion : packageJson.devDependencies.electron.slice(1)
  const PACK_DIR = option.packDir ? option.packDir : path.join(__dirname, '..')
  const DIST_DIR = option.distDir ? option.distDir : path.join(__dirname, '../dist')
  const IGNORE_REGEXP = option.ignore
  const VERSION_STRING = option.versionString

  const ELECTRON_NAME = `electron-v${ELECTRON_VERSION}-${PLATFORM}-${ARCH}`
  // http://cdn.npm.taobao.org/dist/electron/1.8.4/electron-v1.8.4-win32-ia32.zip
  const ELECTRON_URL = `https://cdn.npm.taobao.org/dist/electron/${ELECTRON_VERSION}/${ELECTRON_NAME}.zip`
  // const ELECTRON_URL = `https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/${ELECTRON_NAME}.zip`
  const APP_NAME = `${packageJson.name}-v${packageJson.version}-${PLATFORM}-${ARCH}`
  const ELECTRON_PATH = path.join(DIST_DIR, `${ELECTRON_NAME}.zip`)
  const DIST_PATH = path.join(DIST_DIR, APP_NAME)
  const APP_PATH = path.join(DIST_PATH, 'resources', 'app')
  const NATIVE_PATH = path.join(APP_PATH, './public/lib')

  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR)
  downloadElectronRelease(ELECTRON_URL, ELECTRON_PATH)
    .then(() => {
      if (fs.existsSync(DIST_PATH)) {
        wlog(`[WARNING ${t()}] ${DIST_PATH} exists.`)
        return remove(DIST_PATH)
      }
      return []
    })
    .then(() => unzipElectron(ELECTRON_PATH, DIST_PATH))
    .then(() => new Promise((resolve, reject) => {
      fs.unlinkSync(path.join(DIST_PATH, 'resources', 'default_app.asar'))
      fs.rename(path.join(DIST_PATH, 'electron.exe'), path.join(DIST_PATH, `${packageJson.name}.exe`), err => {
        if (err) reject(err)
        else resolve()
      })
    }))
    .then(() => {
      if (VERSION_STRING) return changeExeInfo(path.join(DIST_PATH, `${packageJson.name}.exe`), VERSION_STRING)
      else return false
    })
    .then((isChanged) => {
      if (isChanged) ilog(`[INFO ${t()}] EXE file changed.`)
      return copy(PACK_DIR, APP_PATH, IGNORE_REGEXP)
    })
    .then(pathArr => {
      let files = fs.readdirSync(NATIVE_PATH)
      for (let i = 0; i < files.length; i++) {
        let abs = path.join(NATIVE_PATH, files[i])
        if (ARCH === 'ia32') {
          if (/-x64\.node$/.test(files[i]) && fs.statSync(abs).isFile()) remove(abs)
        } else {
          if (/-ia32\.node$/.test(files[i]) && fs.statSync(abs).isFile()) remove(abs)
        }
      }
      ilog(`[INFO ${t()}] Pack done.`)
    })
    .catch(err => {
      elog(`[ERROR ${t()}] ${err}`)
    })
}

const option = {
  platform: 'win32',
  arch: process.argv[2] ? process.argv[2] : 'ia32',
  electronVersion: packageJson.devDependencies.electron,
  packDir: path.join(__dirname, '..'),
  distDir: path.join(__dirname, '../dist'),
  ignore: new RegExp(`node_modules|build|data|release|download|dist|src|screenshot|public/img/card|public/asset/sound/live|public/asset/sound/voice|public/asset/score|\\.gitignore|README|\\.eslintrc\\.json|tslint\\.json|tsconfig\\.json|config\\.json|package-lock\\.json|\\.bin|\\.git|\\.vscode`.replace(/\//g, '\\\\')),
  versionString: {
    icon: path.join(__dirname, '../src/res/icon/mishiro.ico'),
    'file-version': packageJson.version,
    'product-version': packageJson.version,
    'version-string': {
      // 'Block Header': '080404b0',
      FileDescription: packageJson.description,
      InternalName: packageJson.name,
      OriginalFilename: packageJson.name + '.exe',
      ProductName: packageJson.name,
      CompanyName: packageJson.author.name,
      LegalCopyright: 'Copyright (C) 2017 Toyobayashi'
    }
  }
}

pack(option)