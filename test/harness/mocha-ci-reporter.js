'use strict'

const { Base, Dot, XUnit } = require('mocha').reporters

// A Mocha reporter that combines the dot and xunit reporters.
class CI extends Base {
  constructor (runner, options) {
    super(runner, options)
    new Dot(runner, options) // eslint-disable-line no-new
    new XUnit(runner, options) // eslint-disable-line no-new
  }
}

module.exports = CI
