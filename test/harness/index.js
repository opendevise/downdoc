'use strict'

process.env.NODE_ENV = 'test'

const assertx = require('./assertx')
const { assert } = assertx
const { after, before, beforeEach, describe, it } = require('node:test')
const fsp = require('node:fs/promises')
const heredoc = require('./heredoc')

const cleanDir = (dir, { create } = {}) =>
  fsp.rm(dir, { recursive: true, force: true }).then(() => (create ? fsp.mkdir(dir, { recursive: true }) : undefined))

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

module.exports = {
  after,
  assert,
  assertx,
  before,
  beforeEach,
  cleanDir,
  describe,
  heredoc,
  it,
  StringIO,
}
