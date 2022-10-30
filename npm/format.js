'use strict'

const { promises: fsp } = require('fs')
const ospath = require('path')
const format = require('prettier-eslint')

async function formatAll (dirs, ignores, cwd = process.cwd()) {
  const result = []
  for (const dir of dirs) {
    const subdirs = []
    const absdir = ospath.join(cwd, dir)
    for await (const dirent of await fsp.opendir(absdir)) {
      const name = dirent.name
      if (dirent.isDirectory()) {
        if (name !== 'node_modules') subdirs.push(name)
      } else if (name.endsWith('.js')) {
        const filePath = ospath.join(absdir, name)
        if (!~ignores.indexOf(filePath)) {
          result.push(
            await fsp.readFile(filePath, 'utf8').then(async (text) => {
              const formatted = await format({ text, filePath })
              return formatted === text ? false : fsp.writeFile(filePath, formatted).then(() => true)
            })
          )
        }
      }
    }
    if (subdirs.length) result.push.apply(result, await formatAll(subdirs, ignores, absdir))
  }
  return result
}

;(async (dirlist) => {
  const cwd = process.cwd()
  //const ignores = await fsp.readFile('.eslintignore', 'utf8').then((contents) =>
  //  contents
  //    .trimRight()
  //    .split('\n')
  //    .map((it) => ospath.join(cwd, it))
  //)
  const ignores = []
  await formatAll(dirlist.split(','), ignores, cwd).then((result) => {
    if (process.env.npm_config_loglevel === 'silent') return
    const total = result.length
    const changed = result.filter((it) => it).length
    const unchanged = total - changed
    const changedStatus = `changed ${changed} file${changed === 1 ? '' : 's'}`
    const unchangedStatus = `left ${unchanged} file${unchanged === 1 ? '' : 's'} unchanged`
    console.log(`prettier-eslint ${changedStatus} and ${unchangedStatus}`)
  })
})(process.argv[2] || '')
