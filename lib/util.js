'use strict'

function parseArgs ({ args = process.argv.slice(2), options = {} }) {
  const positionals = []
  const values = Object.create(null)
  const aliases = Object.entries(options).reduce((accum, [name, { short }]) => {
    if (short) accum['-' + short] = '--' + name
    return accum
  }, {})
  for (let i = -1, end = args.length - 1; i++ < end;) {
    let arg = args[i]
    if (arg in aliases ? (arg = aliases[arg]) : arg.length > 2 && arg.startsWith('--')) {
      const name = arg.slice(2)
      values[name] = (options[name]?.type || (i === end && 'boolean')) === 'boolean' ? true : args[++i]
    } else {
      positionals.push(arg)
    }
  }
  return { values, positionals }
}

module.exports = { parseArgs }
