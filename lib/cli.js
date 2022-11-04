'use strict'

const downdoc = require('downdoc')
const { promises: fsp } = require('node:fs')
const { parseArgs = require('#util').parseArgs } = require('node:util')
const { version } = require('downdoc/package.json')

async function run () {
  const options = { version: { type: 'boolean' } }
  const { positionals, values } = parseArgs({ options, strict: false })
  if (values.version) return printVersion()
  const inputPath = positionals[0]
  await convertFile(inputPath)
}

function convertFile (inputPath, outputPath = toOutputPath(inputPath)) {
  return fsp.readFile(inputPath, 'utf8').then((input) => fsp.writeFile(outputPath, downdoc(input) + '\n', 'utf8'))
}

function printVersion () {
  process.stdout.write(version + '\n')
}

function toOutputPath (path) {
  return path.replace(/\.adoc$/, '.md')
}

module.exports = run
