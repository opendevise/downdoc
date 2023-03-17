/* eslint-env mocha */
'use strict'

process.env.NODE_ENV = 'test'

const chai = require('chai')
const fsp = require('node:fs/promises')

chai.use(require('chai-fs'))
chai.use(require('chai-string'))
// dirty-chai must be loaded after all other plugins
// see https://github.com/prodatakey/dirty-chai#plugin-assertions
chai.use(require('dirty-chai'))

const cleanDir = (dir, { create } = {}) =>
  fsp.rm(dir, { recursive: true, force: true }).then(() => (create ? fsp.mkdir(dir, { recursive: true }) : undefined))

function heredoc (strings, ...values) {
  const first = strings[0]
  if (first[0] !== '\n') {
    return values.length ? values.reduce((accum, value, idx) => accum + value + strings[idx + 1], first) : first
  }
  let string = values.length
    ? (strings = strings.slice()).push(strings.pop().trimEnd()) &&
        values.reduce((accum, _, idx) => accum + '\x1f' + strings[idx + 1], first.slice(1))
    : first.slice(1).trimEnd()
  const lines = string.split('\n')
  const indentSize = lines.reduce((accum, line) =>
    accum && line ? (line[0] === ' ' ? Math.min(accum, line.length - line.trimStart().length) : 0) : accum,
    Infinity
  )
  if (indentSize) {
    string = lines.map((line) => line && line[0] === ' ' ? line.slice(indentSize) : line).join('\n')
    if (!values.length) return string
    strings = string.split('\x1f')
  } else if (!values.length) {
    return string
  }
  return values.reduce((accum, value, idx) => accum + value + strings[idx + 1], strings[0])
}

class StringIO {
  #buffer

  constructor () {
    this.#buffer = []
  }

  reopen () {
    this.#buffer.length = 0
  }

  write (chunk) {
    this.#buffer.push(chunk)
  }

  get string () {
    return this.#buffer.join('')
  }
}

module.exports = { cleanDir, expect: chai.expect, heredoc, StringIO }
