'use strict'

function parseArgs ({ args = process.argv.slice(2), options = {} }) {
  const positionals = []
  const values = Object.create(null)
  for (let i = -1, end = args.length - 1; i++ < end;) {
    const arg = args[i]
    if (arg.length > 2 && arg.startsWith('--')) {
      const name = arg.slice(2)
      values[name] = (options[name]?.type || (i === end && 'boolean')) === 'boolean' ? true : args[++i]
    } else {
      positionals.push(arg)
    }
  }
  return { values, positionals }
}

module.exports = { parseArgs }
