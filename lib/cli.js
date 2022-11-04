'use strict'

const downdoc = require('downdoc')
const { promises: fsp } = require('node:fs')
const { parseArgs = require('#util').parseArgs } = require('node:util')

async function run () {
  const options = {}
  const { positionals } = parseArgs({ options, strict: false })
  const inputPath = positionals[0]
  await convertFile(inputPath)
}

function convertFile (inputPath, outputPath = toOutputPath(inputPath)) {
  return fsp.readFile(inputPath, 'utf8').then((input) => fsp.writeFile(outputPath, downdoc(input) + '\n', 'utf8'))
}

function toOutputPath (path) {
  return path.replace(/\.adoc$/, '.md')
}

module.exports = run
