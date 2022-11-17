'use strict'

const downdoc = require('.')
const fsp = require('node:fs/promises')
const { parseArgs = require('./util').parseArgs } = require('node:util')
const ospath = require('node:path')
const { version } = require('downdoc/package.json')

async function run (p = process) {
  const options = {
    attribute: { type: 'string', multiple: true, short: 'a' },
    output: { type: 'string', short: 'o' },
    postpublish: { type: 'boolean' },
    prepublish: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  }
  const { positionals, values } = parseArgs({ args: p.args || (p.argv || []).slice(2), options, strict: false })
  if (values.help) return printUsage.call(p)
  if (values.version) return printVersion.call(p)
  const inputPath = positionals[0] ?? (values.postpublish || values.prepublish ? 'README.adoc' : undefined)
  if (!inputPath) return printUsage.call(p, true)
  if (values.postpublish) {
    await restoreInputFile(inputPath, values.output)
  } else {
    if (values.prepublish) values.attribute = ['env=npm', 'env-npm'].concat(values.attribute || [])
    const attributes = values.attribute?.reduce((accum, it) => {
      const [name, ...value] = it.split('=')
      accum[name] = value.join('=')
      return accum
    }, {})
    if (!(await validateInputPath.call(p, inputPath))) return
    await convertFile.call(p, inputPath, attributes && { attributes }, values.output)
    if (values.prepublish) await hideInputFile(inputPath)
  }
}

function convertFile (inputPath, opts, outputPath = toOutputPath(inputPath)) {
  const write = (chunk) => (outputPath === '-' ? this.stdout.write(chunk) : fsp.writeFile(outputPath, chunk, 'utf8'))
  return fsp.readFile(inputPath, 'utf8').then((input) => write(downdoc(input, opts) + '\n'))
}

function hideInputFile (inputPath) {
  return fsp.rename(inputPath, hidden(inputPath))
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
  return fsp.stat(path).catch(() => ({ isDirectory: () => false, isFile: () => false }))
}

function printUsage (error) {
  error ? (this.exitCode = 1) : printVersion.call(this, true)
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
  }, this[error ? 'stderr' : 'stdout'])
}

function printVersion (withCommandName) {
  this.stdout.write(`${withCommandName ? 'downdoc ' : ''}${version}\n`)
}

function toOutputPath (path) {
  return path.replace(/\.adoc$/, '.md')
}

function validateInputPath (path) {
  return gracefulStat(path).then((stat) => {
    if (stat.isFile()) return true
    this.exitCode = 1
    this.stderr.write(`downdoc: ${path}: ${stat.isDirectory() ? 'Not a file' : 'No such file'}\n`)
  })
}

module.exports = run
