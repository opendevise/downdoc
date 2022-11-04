'use strict'

const config = {
  checkLeaks: true,
  mochaGlobalTeardown () {
    if (!this.failures) logCoverageReportPath()
  },
  require: __filename,
  spec: resolveSpec(),
  timeout: 10 * 60 * 1000,
}

if (process.env.npm_config_watch) config.watch = true
if (process.env.CI) {
  Object.assign(config, {
    forbidOnly: true,
    reporter: './test/harness/mocha-ci-reporter',
    'reporter-option': ['output=reports/tests-xunit.xml'],
  })
}

function logCoverageReportPath () {
  if (!process.env.NYC_PROCESS_ID) return
  const { CI_PROJECT_PATH, CI_JOB_ID } = process.env
  const coverageReportRelpath = 'reports/lcov-report/index.html'
  const coverageReportURL = CI_JOB_ID
    ? `https://gitlab.com/${CI_PROJECT_PATH}/-/jobs/${CI_JOB_ID}/artifacts/file/${coverageReportRelpath}`
    : require('node:url').pathToFileURL(coverageReportRelpath)
  console.log(`Coverage report: ${coverageReportURL}`)
}

function resolveSpec () {
  const spec = process.argv[2]
  if (spec && !spec.startsWith('-')) return spec
  return 'test/**/*-test.js'
}

module.exports = config
