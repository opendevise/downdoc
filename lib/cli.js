'use strict'

const downdoc = require('./index.js')
const fsp = require('node:fs/promises')
const ospath = require('node:path')
const { parseArgs } = require('node:util')
const readStream = require('./util/read-stream')
const { version } = require('../package.json')

async function run (p = process) {
  const options = {
    attribute: { type: 'string', multiple: true, short: 'a', desc: 'set an AsciiDoc attribute', hint: 'name=val' },
    output: { type: 'string', short: 'o', desc: 'specify an output file or - for stdout', hint: 'path' },
    postpublish: { type: 'boolean', desc: 'run the postpublish lifecycle routine (restore input file)' },
    prepublish: { type: 'boolean', desc: 'run the prepublish lifecycle routine (convert and hide input file)' },
    help: { type: 'boolean', short: 'h', desc: 'output this help and exit' },
    version: { type: 'boolean', short: 'v', desc: 'output version and exit' },
  }
  const { positionals, values } = parseArgs({ args: p.args || (p.argv || []).slice(2), options, strict: false })
  if (values.help) return printUsage.call(p, options)
  if (values.version) return printVersion.call(p)
  const inputPath = positionals[0] ?? (values.postpublish || values.prepublish ? 'README.adoc' : undefined)
  if (!inputPath) return printUsage.call(p, options, true)
  if (values.postpublish) return restoreInputFile(inputPath, values.output)
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

function convertFile (inputPath, opts, outputPath = toOutputPath(inputPath)) {
  const write = (chunk) => (outputPath === '-' ? this.stdout.write(chunk) : fsp.writeFile(outputPath, chunk, 'utf8'))
  const read = () => (inputPath === '-' ? readStream(this.stdin, 'utf8') : fsp.readFile(inputPath, 'utf8'))
  return read().then((input) => write(downdoc(input, opts) + '\n'))
}

function toOutputPath (path) {
  return path === '-' ? path : path.replace(/\.adoc$/, '.md')
}

function hideInputFile (inputPath) {
  return fsp.rename(inputPath, toHiddenPath(inputPath))
}

function restoreInputFile (inputPath, outputPath = toOutputPath(inputPath)) {
  const hiddenInputPath = toHiddenPath(inputPath)
  return Promise.all([
    gracefulStat(hiddenInputPath).then((stat) => (stat.isFile() ? fsp.rename(hiddenInputPath, inputPath) : undefined)),
    gracefulStat(outputPath).then((stat) => (stat.isFile() ? fsp.unlink(outputPath) : undefined)),
  ])
}

function toHiddenPath (path) {
  const { dir, base } = ospath.parse(path)
  return ospath.join(dir, '.' + base)
}

function gracefulStat (path) {
  return fsp.stat(path).catch(() => ({ isDirectory: () => false, isFile: () => false }))
}

function printUsage (options, error) {
  error ? (this.exitCode = 1) : printVersion.call(this, true)
  let usage = [
    'Usage: downdoc [OPTION]... FILE',
    'Convert the specified AsciiDoc FILE to a Markdown file.',
    'Example: downdoc README.adoc',
  ]
  if (error) {
    usage = usage.slice(0, 1).concat("Run 'downdoc --help' for more information.")
  } else {
    usage.push('')
    Object.entries(options).forEach(([long, { short, hint, multiple, desc }]) => {
      const option = short ? `-${short}, --${long}${hint ? ' ' + hint : ''}` : `--${long}`
      usage.push(`  ${option.padEnd(27, ' ')}${desc}${multiple ? '; can be specified multiple times' : ''}`)
    })
    usage.push('', 'If --output is not specified, the output file path is derived from FILE (e.g., README.md).')
  }
  usage.reduce((stream, line) => typeof stream.write(line + '\n') && stream, error ? this.stderr : this.stdout)
}

function printVersion (withCommandName) {
  this.stdout.write(`${withCommandName ? 'downdoc ' : ''}${version}\n`)
}

function validateInputPath (path) {
  if (path === '-') return true
  return gracefulStat(path).then((stat) => {
    if (stat.isFile()) return true
    this.exitCode = 1
    this.stderr.write(`downdoc: ${path}: ${stat.isDirectory() ? 'Not a file' : 'No such file'}\n`)
  })
}

module.exports = run
