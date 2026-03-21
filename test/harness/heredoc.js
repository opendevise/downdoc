'use strict'

function heredoc (strings, ...values) {
  const first = strings[0]
  if (first[0] !== '\n') {
    return values.length ? values.reduce((accum, value, idx) => accum + value + strings[idx + 1], first) : first
  }
  let string = values.length
    ? (strings = strings.slice()).push(strings.pop().trimEnd()) &&
      values.reduce((accum, _, idx) => accum + '\x1f' + strings[idx + 1], first.substring(1))
    : first.substring(1).trimEnd()
  const lines = string.split('\n')
  const indentSize = lines.reduce(
    (accum, line) =>
      accum && line ? (line[0] === ' ' ? Math.min(accum, line.length - line.trimStart().length) : 0) : accum,
    Infinity
  )
  if (indentSize) {
    string = lines.map((line) => (line && line[0] === ' ' ? line.substring(indentSize) : line)).join('\n')
    if (!values.length) return string
    strings = string.split('\x1f')
  } else if (!values.length) {
    return string
  }
  return values.reduce((accum, value, idx) => accum + value + strings[idx + 1], strings[0])
}

module.exports = heredoc
