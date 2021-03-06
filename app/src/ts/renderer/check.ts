import { ProgressInfo } from 'mishiro-core'

const got = window.node.got

let current = 0
let max = 20

function httpGetVersion (resVer: number, progressing: (prog: ProgressInfo) => void): Promise<{ version: number, isExisting: boolean}> {
  const option = {
    url: `http://storage.game.starlight-stage.jp/dl/${resVer}/manifests/all_dbmanifest`,
    headers: {
      'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 7.0; Nexus 42 Build/XYZZ1Y)',
      'X-Unity-Version': '5.4.5p1',
      'Accept-Encoding': 'gzip'
    }
  }
  return new Promise((resolve) => {
    got.get(option.url, {
      headers: option.headers
    }).then(() => {
      current++
      progressing({ current, max, loading: 100 * current / max })
      resolve({ version: resVer, isExisting: true })
    }).catch(() => {
      resolve({ version: resVer, isExisting: false })
    })
    // request(option, (err) => {
    //   if (err) {
    //     resolve({ version: resVer, isExisting: false })
    //   } else {
    //     current++
    //     progressing({ current, max, loading: 100 * current / max })
    //     resolve({ version: resVer, isExisting: true })
    //   }
    // })
    /* request(option, (err, res) => {
      if (err) {
        resolve({ version: resVer, isExisting: false })
      } else {
        current++
        progressing({ current, max, loading: 100 * current / max })
        if (res.statusCode === 200) {
          resolve({ version: resVer, isExisting: true })
        } else {
          resolve({ version: resVer, isExisting: false })
        }
      }
    }) */
  })
}

async function check (progressing: (prog: ProgressInfo) => void): Promise<number> {
  const config = window.preload.configurer.getConfig()
  if (config.resVer) {
    return config.resVer
  }
  const res = await window.preload.client.check()
  if (res !== 0) {
    if (res > (window.preload.configurer.getConfig().latestResVer as number)) {
      console.log(`/load/check [New Version] ${window.preload.configurer.getConfig().latestResVer as number} => ${res}`)
    } else {
      console.log(`/load/check [Latest Version] ${res}`)
    }
    window.preload.configurer.configure('latestResVer', res)
    window.preload.client.resVer = res.toString()
    return res
  } else {
    console.log('/load/check failed')
  }

  const versionFrom = (config.latestResVer as number) - 100

  return new Promise<number>((resolve, reject) => {
    let resVer = versionFrom

    function checkVersion (versionFrom: number): void {
      const versionArr = []
      for (let i = 10; i < 210; i += 10) {
        versionArr.push(Number(versionFrom) + i)
      }
      const promiseArr: Array<Promise<{ version: number, isExisting: boolean}>> = []
      versionArr.forEach((v) => {
        promiseArr.push(httpGetVersion(v, progressing))
      })
      Promise.all(promiseArr).then((arr) => {
        max += 20
        const temp = arr
        let isContinue = false
        for (let i = temp.length - 1; i >= 0; i--) {
          if (temp[i].isExisting) {
            isContinue = true
            resVer = temp[i].version
            checkVersion(temp[temp.length - 1].version)
            break
          }
        }
        if (!isContinue) {
          window.preload.configurer.configure('latestResVer', resVer)
          window.preload.client.resVer = resVer.toString()
          resolve(resVer)
        }
      }).catch(err => reject(err))
    }
    checkVersion(versionFrom)
  })
}
export default check
