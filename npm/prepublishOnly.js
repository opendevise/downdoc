'use strict'

const downdoc = require('..')
const { promises: fsp } = require('fs')

const README_SRC = 'README.adoc'
const README_HIDDEN = '.' + README_SRC
const README_DEST = 'README.md'

/**
 * Transforms the AsciiDoc README (README.adoc) in the working directory into
 * Markdown format (README.md) and hides the AsciiDoc README (.README.adoc).
 */
;(async () => {
  const readmeSrc = await fsp.stat(README_SRC).then((stat) => (stat.isFile() ? README_SRC : README_HIDDEN))
  await Promise.all([
    fsp.readFile(readmeSrc, 'utf8').then((asciidoc) => fsp.writeFile(README_DEST, downdoc(asciidoc))),
    readmeSrc === README_SRC ? fsp.rename(README_SRC, README_HIDDEN) : Promise.resolve(),
  ])
})()
