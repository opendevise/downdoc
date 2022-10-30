/* eslint-env mocha */
'use strict'

process.env.NODE_ENV = 'test'

const chai = require('chai')
chai.use(require('chai-fs'))
chai.use(require('dirty-chai'))
const outdent = require('outdent')

module.exports = { expect: chai.expect, outdent }
