'use strict'

const downdoc = require('.')
const { promises: fsp } = require('node:fs')
const { parseArgs = require('./util').parseArgs } = require('node:util')
const ospath = require('node:path')
const { version } = require('downdoc/package.json')

async function run () {
  const options = {
    attribute: { type: 'string', multiple: true, short: 'a' },
    output: { type: 'string', short: 'o' },
    postpublish: { type: 'boolean' },
    prepublish: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  }
  const { positionals, values } = parseArgs({ options, strict: false })
  if (values.help) return printUsage()
  if (values.version) return printVersion()
  const inputPath = positionals[0] ?? (values.postpublish || values.prepublish ? 'README.adoc' : undefined)
  if (!inputPath) return printUsage(true)
  if (values.postpublish) {
    await restoreInputFile(inputPath, values.output)
  } else {
    const attributes = values.attribute?.reduce(
      (accum, it) => {
        const [name, ...value] = it.split('=')
        accum[name] = value.join('=')
        return accum
      },
      values.prepublish ? { env: 'npm', 'env-npm': '' } : {}
    )
    await convertFile(inputPath, attributes && { attributes }, values.output)
    if (values.prepublish) await hideInputFile(inputPath)
  }
}

function convertFile (inputPath, opts, outputPath = toOutputPath(inputPath)) {
  const write = outputPath === '-' ? process.stdout.write.bind(process.stdout) : fsp.writeFile.bind(null, outputPath)
  return fsp.readFile(inputPath, 'utf8').then((input) => write(downdoc(input, opts) + '\n', 'utf8'))
}

function hideInputFile (inputPath) {
  return gracefulStat(inputPath).then((stat) => (stat.isFile() ? fsp.rename(inputPath, hidden(inputPath)) : undefined))
}

function restoreInputFile (inputPath, outputPath = toOutputPath(inputPath)) {
  const hiddenInputPath = hidden(inputPath)
  return Promise.all([
    gracefulStat(hiddenInputPath).then((stat) => (stat.isFile() ? fsp.rename(hiddenInputPath, inputPath) : undefined)),
    gracefulStat(outputPath).then((stat) => (stat.isFile() ? fsp.unlink(outputPath) : undefined)),
  ])
}

function hidden (path) {
  const { dir, base } = ospath.parse(path)
  return ospath.join(dir, '.' + base)
}

function gracefulStat (path) {
  return fsp.stat(path).catch(() => ({ isFile: () => false }))
}

function printUsage (error) {
  error ? (process.exitCode = 1) : printVersion(true)
  let usage = [
    'Usage: downdoc [OPTION]... FILE',
    'Convert the specified AsciiDoc FILE to a Markdown file.',
    'Example: downdoc README.adoc',
    'If --output is not specified, the output file path is derived from FILE (e.g., README.md).',
  ]
  if (error) usage = usage.slice(0, 1).concat("Run 'downdoc --help' for more information.")
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
