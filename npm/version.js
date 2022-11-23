'use strict'

const fsp = require('node:fs/promises')
const ospath = require('node:path')

const PROJECT_ROOT_DIR = ospath.join(__dirname, '..')
const CHANGELOG_FILE = ospath.join(PROJECT_ROOT_DIR, 'CHANGELOG.adoc')
const VERSION = process.env.npm_package_version

function getCurrentDate () {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
}

function updateChangelog (releaseDate) {
  return fsp.readFile(CHANGELOG_FILE, 'utf8').then((changelog) =>
    fsp.writeFile(
      CHANGELOG_FILE,
      changelog.replace(/^== (?:(Unreleased)|\d.*)$/m, (currentLine, replace) => {
        const newLine = `== ${VERSION} (${releaseDate})`
        return replace ? newLine : [newLine, '_No changes since previous release._', currentLine].join('\n\n')
      })
    )
  )
}

;(async () => {
  const releaseDate = getCurrentDate().toISOString().split('T')[0]
  await updateChangelog(releaseDate)
})()
