'use strict'

const downdoc = require('downdoc')
const { promises: fsp } = require('node:fs')
const { parseArgs = require('#util').parseArgs } = require('node:util')
const { version } = require('downdoc/package.json')

async function run () {
  const options = { help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' } }
  const { positionals, values } = parseArgs({ options, strict: false })
  if (values.help) return printUsage()
  if (values.version) return printVersion()
  const inputPath = positionals[0]
  if (!inputPath) return printUsage(true)
  await convertFile(inputPath)
}

function convertFile (inputPath, outputPath = toOutputPath(inputPath)) {
  return fsp.readFile(inputPath, 'utf8').then((input) => fsp.writeFile(outputPath, downdoc(input) + '\n', 'utf8'))
}

function printUsage (error) {
  error ? (process.exitCode = 1) : printVersion(true)
  let usage = [
    'Usage: downdoc FILE',
    'Convert the specified AsciiDoc FILE to a Markdown file.',
    'Example: downdoc README.adoc',
    'The path of the output file is derived from FILE (e.g., README.md).',
  ]
  if (error) usage = usage.slice(0, 1).concat('Run \'downdoc --help\' for more information.')
  usage.reduce((stream, line) => {
    stream.write(line + '\n')
    return stream
  }, process[error ? 'stderr' : 'stdout'])
}

function printVersion (withCommandName) {
  process.stdout.write(`${withCommandName ? 'downdoc ' : ''}${version}\n`)
}

function toOutputPath (path) {
  return path.replace(/\.adoc$/, '.md')
}

module.exports = run
