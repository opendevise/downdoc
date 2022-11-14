/* eslint-env mocha */
'use strict'

process.env.NODE_ENV = 'test'

const chai = require('chai')
chai.use(require('chai-fs'))
chai.use(require('chai-string'))
chai.use(require('dirty-chai'))

const { promises: fsp } = require('fs')

const cleanDir = (dir, { create } = {}) =>
  fsp.rm(dir, { recursive: true, force: true }).then(() => (create ? fsp.mkdir(dir, { recursive: true }) : undefined))

const heredoc = (literals) => {
  const str = literals[0].trimEnd()
  let lines = str.split(/^/m)
  if (lines[0] === '\n') lines = lines.slice(1)
  if (lines.length < 2) return str // discourage use of heredoc in this case
  const last = lines.pop()
  if (last != null) {
    lines.push(last[last.length - 1] === '\\' && last[last.length - 2] === ' ' ? last.slice(0, -2) + '\n' : last)
  }
  const indentRx = /^ +/
  const indentSize = Math.min(...lines.filter((l) => l.charAt() === ' ').map((l) => l.match(indentRx)[0].length))
  return (indentSize ? lines.map((l) => (l.charAt() === ' ' ? l.slice(indentSize) : l)) : lines).join('')
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
