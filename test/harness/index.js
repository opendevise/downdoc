/* eslint-env mocha */
'use strict'

process.env.NODE_ENV = 'test'

const chai = require('chai')
chai.use(require('chai-fs'))
chai.use(require('dirty-chai'))

const heredoc = (literals) => {
  const str = literals[0].trimRight()
  const lines = str.split(/^/m)
  if (lines.length < 2) return str
  if (lines[0] === '\n') lines.shift()
  const indentRx = /^ +/
  const indentSize = Math.min(...lines.filter((l) => l.charAt() === ' ').map((l) => l.match(indentRx)[0].length))
  return (indentSize ? lines.map((l) => (l.charAt() === ' ' ? l.slice(indentSize) : l)) : lines).join('')
}

module.exports = { expect: chai.expect, heredoc }
