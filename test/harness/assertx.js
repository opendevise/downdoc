'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')

const assertx = {
  assert,
  contents: (actual, expected, msg) => {
    assertx.file(actual)
    assert.equal(fs.readFileSync(actual, 'utf8'), expected, msg)
  },
  empty: (actual, msg = 'Expected value to be empty') => assert.equal(actual.length, 0, msg),
  endWith: (actual, expected) => assert(actual.endsWith(expected), `Expected ${actual} to end with ${expected}`),
  file: (actual) => {
    let stat
    try {
      stat = fs.statSync(actual)
    } catch {
      stat = { isFile: () => false }
    }
    assert(stat.isFile(), `Expected value to be a file: ${actual}`)
  },
  include: (actual, expected) => assert(actual.includes(expected), `Expected ${actual} to include ${expected}`),
  notEmpty: (actual, msg = 'Expected value to not be empty') => assert.notEqual(actual.length, 0, msg),
  notPath: (actual) => {
    try {
      fs.accessSync(actual, fs.constants.F_OK)
      assert.fail(`Expected value to not be a path: ${actual}`)
    } catch {}
  },
  startWith: (actual, expected) => assert(actual.startsWith(expected), `Expected ${actual} to start with ${expected}`),
}

module.exports = assertx
