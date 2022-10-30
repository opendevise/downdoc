'use strict'

const ADMONITION_EMOJI = { CAUTION: '🔥', IMPORTANT: '❗', NOTE: '📌', TIP: '💡', WARNING: '⚠️' }
const CONUMS = { 1: '❶', 2: '❷', 3: '❸', 4: '❹', 5: '❺', 6: '❻', 7: '❼', 8: '❽', 9: '❾' }
const POSITIVE_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

const AttributeEntryRx = /^:([^:]+):(?: (.+)|)$/
const AttributeReferenceRx = /\{([a-z0-9_-]+)\}/g
const AuthorInfoLineRx = /^(?:[\p{Alpha}0-9_]+(?: +[\p{Alpha}0-9_]+){0,2}(?: +<([^>]+)>)?(?:; |$))+$/u
const ConditionalDirectiveRx = /^if(n)?def::([^[]+)\[(.+)?\]$/
const ConumRx = / <([1-9])>$/
const MacroRx = /(?:link:|(image:)?(https?:))([^[]+)\[(|.*?[^\\])\]/g
const SectionMarkerRx = /^=+(?= \S)/

function downdoc (asciidoc) {
  const lines = asciidoc.trimRight().split('\n')
  const firstEmptyLineIdx = lines.indexOf('')
  const headerLines = asciidoc.startsWith('= ') && ~firstEmptyLineIdx ? lines.slice(0, firstEmptyLineIdx) : []
  let seedAttrs = {}
  if (headerLines.length > 1 && headerLines[1].match(AuthorInfoLineRx)) {
    const authors = headerLines[1].split('; ').map((it) => it.split(' <')[0])
    seedAttrs = { author: authors[0], authors: authors.join(', ') }
    lines.splice(1, 1)
  }
  const attrs = headerLines.reduce((accum, line) => {
    if (line.startsWith('ifndef::')) {
      const lsbIdx = line.indexOf('[')
      if (!(line.slice(8, lsbIdx) in accum)) line = line.slice(lsbIdx + 1, line.length - 1)
    }
    if (line.charAt() === ':') {
      const [, name, value = ''] = line.match(AttributeEntryRx)
      accum[name] = replaceAttributeReferences(value, accum)
    }
    return accum
  }, seedAttrs)
  let verbatim = false
  let subAttrs = false
  let skipping = false
  let indent
  let listNumeral = 1
  let prev
  return lines
    .reduce((accum, line) => {
      while (true) {
        const line_ = line
        const chr0 = line.charAt()
        if (skipping) {
          if (line === 'endif::[]' || line === '////' || line === '|===') {
            skipping = false
            while (accum[accum.length - 1] === '') accum.pop()
          }
          line = undefined
        } else if (verbatim) {
          if (line === '----') {
            line = '```'
            verbatim = false
          } else {
            if (line.charAt(line.length - 1) === '>') line = line.replace(ConumRx, (_, conum) => ' ' + CONUMS[conum])
            if (subAttrs) line = replaceAttributeReferences(line, attrs)
          }
        } else if (chr0) {
          if (line === 'endif::[]' || chr0 === ':' || (chr0 === '[' && line.charAt(line.length - 1) === ']')) {
            line = undefined
          } else if (chr0 === '/' && line.charAt(1) === '/') {
            if (line === '////') skipping = true
            line = undefined
          } else if (line === '|===') {
            skipping = true
            line = undefined
          } else if (chr0 === 'i' && (line.startsWith('ifdef::') || line.startsWith('ifndef::'))) {
            const [, negated, name, text] = line.match(ConditionalDirectiveRx)
            skipping = negated ? name in attrs : !(name in attrs)
            if (text) {
              if (!skipping) {
                line = text
                continue
              }
              skipping = false
            }
            line = undefined
          } else if (chr0 === '=') {
            line = line.replace(SectionMarkerRx, (m) => '#'.repeat(m.length))
          } else if (chr0 === '.') {
            line = line.charAt(1) === ' ' ? `${listNumeral++}${line}` : `**${line.substr(1)}**`
          } else if (line === '----') {
            line = '```'
            verbatim = true
            subAttrs = false
            if (prev && prev.charAt(0) === '[') {
              const blockAttrs = prev.substr(1, prev.length - 2).split(',')
              if (blockAttrs[1]) line += blockAttrs[1] // append the source language
              if (blockAttrs.includes('subs=+attributes') || blockAttrs.includes('subs=attributes+')) subAttrs = true
            }
          } else if (chr0 === ' ' && (!prev || prev.charAt(0) === ' ')) {
            if (!prev) indent = line.length - line.trimStart().length
            line = `    ${line.replace(' '.repeat(indent), '')}`
          } else if (chr0 === '<' && POSITIVE_DIGITS.includes(line.charAt(1))) {
            line = line.substr(1).replace('>', '.')
          } else {
            line = replaceAttributeReferences(line, attrs)
              .replace(
                MacroRx,
                (_, img = '', scheme = '', target, text) =>
                  `${img && '!'}[${text.split(',')[0] || scheme + target}](${scheme + target})`
              )
              .replace(/(?:\[[^[\]]+\]|)(?<!\\)(\*.+?\*)/g, '*$1*')
              .replace(/(?:\[[^[\]]+\]|)\b(?<!\\)_(.+?)_(?=\b)/g, '*$1*')
              .replace(/`\\/g, '`')
              .replace(
                /^(CAUTION|IMPORTANT|NOTE|TIP|WARNING):\s/,
                (_, type) => `${ADMONITION_EMOJI[type]} **${type}:** `
              )
          }
        } else {
          listNumeral = 1
        }
        if (line !== undefined) accum.push(line)
        prev = line_
        return accum
      }
    }, [])
    .join('\n')
}

function replaceAttributeReferences (text, attrs) {
  if (!(text && ~text.indexOf('{'))) return text
  return text.replace(AttributeReferenceRx, (match, name) => (name in attrs ? attrs[name] : match))
}

module.exports = downdoc
