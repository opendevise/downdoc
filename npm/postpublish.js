'use strict'

const { promises: fsp } = require('fs')

const README_SRC = 'README.adoc'
const README_HIDDEN = '.' + README_SRC
const README_DEST = 'README.md'

/**
 * Removes the generated Markdown README (README.md) in the working directory
 * and restores the hidden AsciiDoc README (.README.adoc -> README.adoc).
 */
;(async () => {
  await Promise.all([
    fsp.stat(README_DEST).then((stat) => stat.isFile() && fsp.unlink(README_DEST)),
    fsp.stat(README_HIDDEN).then((stat) => stat.isFile() && fsp.rename(README_HIDDEN, README_SRC)),
  ])
})()
