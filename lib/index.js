'use strict'

const ADMONITION_ICONS = {
  CAUTION: '\ud83d\udd25',
  IMPORTANT: '\u2757',
  NOTE: '\ud83d\udccc',
  TIP: '\ud83d\udca1',
  WARNING: '\u26a0\ufe0f',
}
const CONUMS = [undefined, '\u2776', '\u2777', '\u2778', '\u2779', '\u277a', '\u277b', '\u277c', '\u277d', '\u277e']
const LIST_MARKERS = { '*': true, '.': true, '-': true }
const NORMAL_SUBS = ['quotes', 'attributes', 'macros']

const AdmonitionLabelRx = new RegExp(`^(${Object.keys(ADMONITION_ICONS).join('|')}):(?=\\s)`)
const AttributeEntryRx = /^:([^:]+):(?:$| (.+))/
const AttributeReferenceRx = /\\?\{([a-z0-9_-]+)\}/g
const AuthorInfoLineRx = /^(?:[\p{Alpha}0-9_]+(?: +[\p{Alpha}0-9_]+){0,2}(?: +<([^>]+)>)?(?:; |$))+$/u
const BlockIdRx = /^\[(?:\[|#)([^,.%\]]+).*\]$/
const BlockImageMacroRx = /^image::([^\s[]+)\[(.*)\]$/
const ConditionalDirectiveRx = /^if(n)?def::([^[]+)\[(.+)?\]$/
const ConumRx = /(^| )<([1-9])>$/
const ExternalXrefTargetRx = /\.adoc$|#/
const LinkMacroRx = /(?:link:|(https?:\/\/))([^\s[\\]+)\[(|.*?[^\\])\]|\\(https?:)(\/\/[^\s[\]]+)(?=\s|$)/g
const ListItemRx = /^(\*+|\.+|-) (\S.*)/
const InlineImageMacroRx = /image:(?!:)([^\s[\\]+)\[(|.*?[^\\])\]/g
const RevisionInfoLineRx = /^v(\d+(?:[-.]\w+)*)(?:, (\d+-\d+-\d+))?|(\d+-\d+-\d+)$/
const RewriteInternalXrefRx = /!!\[(|.*?[^\\])\]\(#([^)]+)\)/g
const SectionTitleRx = /^(=+) (\S.*)/
const SubAttributesRx = /^subs=(")?\+?attributes\+?\1$/
const TrailingHashRx = /#$/
const XrefRx = /xref:#?([^\s[\\]+)\[(|.*?[^\\])\]|<<#?([^,<>]+)(?:, ?([^<>]+))?>>/g

function downdoc (asciidoc, { attributes } = {}) {
  const attrs = Object.assign({ idprefix: '_', idseparator: '_' }, (attributes ??= {}))
  delete attrs.doctitle
  const convertInline = { attributes: replaceAttributeReferences.bind(attrs), macros, quotes }
  const lines = asciidoc.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  const refs = {}
  let inBlock = false
  let inHeader = asciidoc.charCodeAt() === 61 || (~asciidoc.indexOf('\n= ') ? true : false) // eslint-disable-line
  let verbatim = false
  let skipping = false
  const listStack = Object.defineProperty([], 'indent', {
    get: () => (listStack.length ? listStack.reduce((accum, { indent }) => accum + indent, '') : ''),
  })
  let cap, indent, outdent, prev, subs, match
  return lines
    .reduce((accum, line) => {
      while (true) {
        const line_ = line
        if (skipping || line === 'endif::[]') {
          if (line === 'endif::[]' || line === '////' || (!inHeader && line === '|===')) skipping = false
          line = undefined
        } else if (verbatim) {
          if (line === '----' || line === '....') {
            verbatim = false
            line = '```'
          } else if (line.length > 2 && line.charAt(line.length - 1) === '>') {
            line = line.replace(ConumRx, (_, leadingSpace, conum) => leadingSpace + CONUMS[conum])
          }
        } else if (line.length) {
          subs = undefined
          const chr0 = line.charAt()
          if (inBlock == null) {
            if (chr0 in LIST_MARKERS && ListItemRx.test(line)) {
              accum.pop()
            } else {
              indent = undefined
              listStack.splice(0)
            }
            inBlock = false
          }
          if (chr0 === '/' && line.charAt(1) === '/') {
            if (line === '////') inBlock = !(skipping = true)
            line = undefined
          } else if (chr0 === 'i' && ~line.indexOf('def::') && (match = ConditionalDirectiveRx.exec(line))) {
            const [, negated, name, text] = match
            skipping = negated ? name in attrs : !(name in attrs)
            if (text) {
              if (!skipping) {
                line = text
                continue // reprocess line
              }
              skipping = false
            }
            line = undefined
          } else if (chr0 === '=' && !inBlock && (match = SectionTitleRx.exec(line))) {
            let [, marker, title] = match
            if (inHeader) {
              if ('doctitle' in attrs || marker.length > 1) {
                inHeader = false
                if (accum.length) return accum
                continue // reprocess line
              }
              attrs.doctitle = title
            } else {
              title = convertInline.attributes(title)
            }
            const titleWords = title.split(' ')
            let id = ((prev && prev.charAt() === '[' && BlockIdRx.exec(prev)) || [])[1]
            if (!(id == null && inHeader)) {
              id ??= attrs.idprefix + titleWords.join(attrs.idseparator).toLowerCase()
              refs[id] = { autoId: titleWords.join('-').toLowerCase(), title }
            }
            line = '#'.repeat(marker.length) + ' ' + title
          } else if (chr0 === ':' && !inBlock && (match = AttributeEntryRx.exec(line))) {
            const [, name, value = ''] = match
            if (!(name in attributes)) attrs[name] = convertInline.attributes(value)
            line = undefined
          } else if (chr0 === '[' && line.charAt(line.length - 1) === ']') {
            inBlock = false
            line = undefined
          } else if (inHeader) {
            if ((inHeader = 'doctitle' in attrs)) {
              if (!('author' in attrs) && AuthorInfoLineRx.test(line)) {
                const authors = line.split('; ').map((it) => it.split(' <')[0])
                Object.assign(attrs, { author: authors[0], authors: authors.join(', ') })
              } else if (!('revdate' in attrs) && !('revnumber' in attrs) && (match = RevisionInfoLineRx.exec(line))) {
                console.dir(match)
                const [, revnumber, revdate_, revdate = revdate_] = match
                Object.assign(attrs, revnumber && { revnumber }, revdate && { revdate })
              } else {
                inHeader = false
              }
            }
            if (!inHeader && !accum.length) continue // reprocess line
            line = undefined
          } else if (line === '----' || line === '....') {
            inBlock = !(verbatim = true)
            line = '```'
            if (prev && prev.charAt(0) === '[') {
              const blockAttrs = prev.slice(1, -1).split(',')
              line += (blockAttrs[line_ === '----' ? 1 : 0] || '').trimStart() // append the source language
              const subsAttr = blockAttrs.find((it) => it.startsWith('subs='))
              if (subsAttr && SubAttributesRx.test(subsAttr)) subs = ['attributes']
            }
          } else if (line === '|===') {
            inBlock = !(skipping = true)
            line = undefined
          } else if (line === '+' && listStack.length) {
            indent = listStack.indent
            inBlock = false
            line = ''
          } else if (chr0 in LIST_MARKERS && (!inBlock || listStack.length) && (match = ListItemRx.exec(line))) {
            const [, marker, text] = match
            subs = NORMAL_SUBS
            const ordered = marker.charAt() === '.'
            let list
            if (listStack.length) {
              const siblingIdx = listStack.findIndex(({ marker: candidate }) => candidate === marker)
              ~siblingIdx && listStack.splice(siblingIdx + 1)
              if (marker === (list = listStack[listStack.length - 1]).marker) listStack.pop()
            }
            indent = listStack.indent
            if (!list || marker !== list.marker) {
              list = ordered ? { marker, numeral: 0, indent: '   ' } : { marker, indent: '  ' }
            }
            listStack.push(list)
            cap && accum.push(cap) && (cap = undefined)
            inBlock = true
            line = ordered ? `${(list.numeral += 1)}. ${text}` : '* ' + text
          } else if (inBlock) {
            if (chr0 === ' ' && outdent != null) {
              line = line.slice(outdent)
            } else {
              subs = NORMAL_SUBS
              const last = accum[accum.length - 1]
              if (last && last[last.length - 1] === '+' && last[last.length - 2] === ' ') {
                accum[accum.length - 1] = last.slice(0, -2) + '\\'
              }
            }
          } else if (chr0 === '.') {
            const chr1 = line.charAt(1)
            if (chr1 && !(chr1 === '.' && line.charAt(2) === '.')) {
              subs = NORMAL_SUBS
              line = chr1 === '*' ? line.slice(1) + '\n' : `*${line.slice(1)}*\n`
            }
          } else if (chr0 === ' ') {
            outdent = line.length - line.trimStart().length
            indent = listStack.indent
            if (line.charAt(outdent) === '$' && line.charAt(outdent + 1) === ' ') {
              accum.push((cap = indent + '```') + 'console')
            } else {
              indent += '    '
            }
            inBlock = true
            line = line.slice(outdent)
          } else if (line === 'toc::[]') {
            line = undefined
          } else if (chr0 === '<' && CONUMS[line.charAt(1)]) {
            subs = NORMAL_SUBS
            line = line.slice(1).replace('>', '.')
          } else if (chr0 === chr0.toUpperCase() && ~line.indexOf(': ') && (match = AdmonitionLabelRx.exec(line))) {
            subs = NORMAL_SUBS
            const label = match[1]
            inBlock = true
            line = `${ADMONITION_ICONS[label]} *${label}:*${line.slice(label.length + 1)}`
          } else if (chr0 === 'i' && line.startsWith('image::') && (match = BlockImageMacroRx.exec(line))) {
            const [, target, text] = match
            subs = ['attributes']
            line = `![${text.split(',')[0]}](${target})`
          } else {
            subs = NORMAL_SUBS
            inBlock = true
          }
        } else {
          if (!accum[accum.length - 1]) line = undefined
          inHeader = false
          inBlock = listStack.length ? undefined : !!(indent = undefined)
          outdent = undefined
          cap && accum.push(cap) && (cap = undefined)
        }
        if (line !== undefined) {
          if (line.length) {
            if (subs) line = subs.reduce((accum, name) => convertInline[name](accum), line)
            if (indent) line = indent + line
          }
          accum.push(line)
        }
        prev = line_
        return accum
      }
    }, [])
    .join('\n')
    .replace(RewriteInternalXrefRx, (_, text, id) => {
      const { title = id, autoId = id } = refs[id] || {}
      return `[${text || title}](#${autoId})`
    })
    .trimEnd()
    .concat(cap ? '\n' + cap : '')
}

function quotes (str) {
  return str
    .replace(/(?:\[[^[\]]+\]|)(?<!\\)\*(\S|\S.*?\S)\*/g, '**$1**')
    .replace(/(?:\[[^[\]]+\]|)\b(?<!\\)_(\S|\S.*?\S)_(?=\b)/g, '_$1_')
    .replace(/"`(\S|\S.*?\S)`"/g, '<q>$1</q>')
    .replace(/`'|(?<=[\p{Alpha}0-9])'(?=\p{Alpha})/gu, '\u2019')
    .replace(/`\\/g, '`')
}

function macros (str) {
  return str
    .replace(InlineImageMacroRx, (_, target, text) => `![${text.split(',')[0] || target.split('/').pop()}](${target})`)
    .replace(LinkMacroRx, (_, scheme = '', url, text, escProtocol, escUrl) => {
      return escProtocol ? `<span>${escProtocol}</span>${escUrl}` : `[${text || scheme + url}](${scheme + url})`
    })
    .replace(XrefRx, (_, _id, _text = '', id = _id, text = _text) => {
      return ExternalXrefTargetRx.test(id) ? `[${text}](${id.replace(TrailingHashRx, '')})` : `!![${text}](#${id})`
    })
}

function replaceAttributeReferences (str) {
  return str && ~str.indexOf('{') ? str.replace(AttributeReferenceRx, replaceAttributeReference.bind(this)) : str
}

function replaceAttributeReference (match, name) {
  return match.charAt() === '\\' ? match.slice(1) : name in this ? this[name] : match
}

module.exports = downdoc
