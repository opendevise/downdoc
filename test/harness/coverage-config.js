'use strict'

const fs = require('node:fs')
const url = require('node:url')

if (process.env.NODE_TEST_CONTEXT !== 'child-v8' && ['nyc', 'c8'].includes(process.env.npm_lifecycle_script)) {
  const reportDir = JSON.parse(process.env.NYC_CONFIG || '{}').reportDir || process.env.NYC_REPORT_DIR || 'reports'
  fs.mkdirSync(reportDir, { recursive: true })
  process.on('exit', () => process.exitCode || logCoverageReportPath(`${reportDir}/lcov-report/index.html`))
}

function logCoverageReportPath (coverageReportRelpath) {
  if (process.env.npm_lifecycle_script === 'nyc' && !fs.existsSync(coverageReportRelpath)) return
  if (process.env.CI) return
  const coverageReportURL = url.pathToFileURL(coverageReportRelpath)
  console.log(`Coverage report: ${coverageReportURL}`)
}
