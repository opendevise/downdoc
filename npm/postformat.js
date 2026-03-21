'use strict'

const { promises: fsp } = require('node:fs')

const FN1_RX = /((?:^ *|[,=] )(?:async )?function [$]?\w+)(\((?:$|.*\) {(?:$|})))/gm
const FN2_RX = /(^ +(?:(?:async|get|set|static(?: async)?|) |[*])?[\w$]+)(\(.*\) {(?:},)?)$/gm
const IIFE_RX = /([^\n])\n(;\((?:async )?\(\) => {)/

;(async () => {
  const globs = await fsp
    .readFile('biome.json', 'utf8')
    .then(JSON.parse)
    .then((config) => config.files.includes)
  for await (const entry of fsp.glob(globs)) {
    if (!entry.endsWith('.js')) continue
    await fsp.readFile(entry, 'utf8').then((contents) => {
      contents = contents.replace(FN1_RX, '$1 $2').replace(FN2_RX, '$1 $2').replace(IIFE_RX, '$1\n\n$2')
      return fsp.writeFile(entry, contents, 'utf8')
    })
  }
})()
