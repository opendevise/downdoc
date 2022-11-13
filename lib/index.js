'use strict'

const ADMONITION_EMOJI = { CAUTION: '🔥', IMPORTANT: '❗', NOTE: '📌', TIP: '💡', WARNING: '⚠️' }
const CONUMS = { 1: '❶', 2: '❷', 3: '❸', 4: '❹', 5: '❺', 6: '❻', 7: '❼', 8: '❽', 9: '❾' }
const NORMAL_SUBS = ['quotes', 'attributes', 'macros']

const AdmonitionLabelRx = /^(CAUTION|IMPORTANT|NOTE|TIP|WARNING):(?=\s)/
const AttributeEntryRx = /^:([^:]+):(?: (.+)|)$/
const AttributeReferenceRx = /\\?\{([a-z0-9_-]+)\}/g
const AuthorInfoLineRx = /^(?:[\p{Alpha}0-9_]+(?: +[\p{Alpha}0-9_]+){0,2}(?: +<([^>]+)>)?(?:; |$))+$/u
const BlockIdRx = /^\[[[#]([^,.%\]]+).*\]$/
const ConditionalDirectiveRx = /^if(n)?def::([^[]+)\[(.+)?\]$/
const ConumRx = / <([1-9])>$/
const ExternalXrefTargetRx = /\.adoc$|#/
const ListItemRx = /^(\.+|\*+) (\S.*)$/
const MacroRx = /(?:link:|(image::?)|(https?:))([^[\\]+)\[(|.*?[^\\])\]/g
const RewriteInternalXrefRx = /!!\[(|.*?[^\\])\]\(#([^)]+)\)/g
const SectionTitleRx = /^(=+) (\S.*)$/
const SubAttributesRx = /^subs=(")?\+?attributes\+?\1$/
const TrailingHashRx = /#$/
const XrefRx = /xref:#?([^[\\]+)\[(|.*?[^\\])\]|<<#?([^,<>]+)(?:, ?([^<>]+))?>>/g

function downdoc (asciidoc, { attributes } = {}) {
  const attrs = Object.assign({ idprefix: '_', idseparator: '_' }, (attributes ??= {}))
  delete attrs.doctitle
  const convertInline = { attributes: replaceAttributeReferences.bind(attrs), macros, quotes }
  const lines = asciidoc.trimEnd().split('\n')
  const refs = {}
  let inBlock = false
  let inHeader = true
  let verbatim = false
  let skipping = false
  let listStack = []
  let cap, indent, outdent, prev, subs
  return lines
    .reduce((accum, line) => {
      while (true) {
        const line_ = line
        let chr0, m
        if (skipping || line === 'endif::[]') {
          if (line === 'endif::[]' || line === '////' || (!inHeader && line === '|===')) skipping = false
          line = undefined
        } else if (verbatim) {
          if (line === '----' || line === '....') {
            verbatim = false
            line = '```'
          } else if (line.charAt(line.length - 1) === '>') {
            line = line.replace(ConumRx, (_, conum) => ' ' + CONUMS[conum])
          }
        } else if ((chr0 = line.charAt())) {
          subs = undefined
          if (chr0 === '/' && line.charAt(1) === '/') {
            if (line === '////') inBlock = !(skipping = true)
            line = undefined
          } else if (chr0 === 'i' && ~line.indexOf('def::') && (m = line.match(ConditionalDirectiveRx))) {
            const [, negated, name, text] = m
            skipping = negated ? name in attrs : !(name in attrs)
            if (text) {
              if (!skipping) {
                line = text
                continue // reprocess line
              }
              skipping = false
            }
            line = undefined
          } else if (!inBlock && chr0 === '=' && (m = line.match(SectionTitleRx))) {
            let [, marker, title] = m
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
            let id = ((prev && prev.charAt() === '[' && prev.match(BlockIdRx)) || [])[1]
            if (!(id == null && inHeader)) {
              id ??= attrs.idprefix + titleWords.join(attrs.idseparator).toLowerCase()
              refs[id] = { autoId: titleWords.join('-').toLowerCase(), title }
            }
            line = '#'.repeat(marker.length) + ' ' + title
          } else if (inHeader) {
            if (chr0 === ':' && (m = line.match(AttributeEntryRx))) {
              const [, name, value = ''] = m
              if (!(name in attributes)) attrs[name] = convertInline.attributes(value)
            } else if ('doctitle' in attrs && !('author' in attrs) && AuthorInfoLineRx.test(line)) {
              const authors = line.split('; ').map((it) => it.split(' <')[0])
              Object.assign(attrs, { author: authors[0], authors: authors.join(', ') })
            } else {
              inHeader = false
              if (!accum.length) continue // reprocess line
            }
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
          } else if (chr0 === '[' && line.charAt(line.length - 1) === ']') {
            inBlock = false
            line = undefined
          } else if (line === '|===') {
            inBlock = !(skipping = true)
            line = undefined
          } else if (line === '+' && listStack.length) {
            indent = listStack[listStack.length - 1].indent
            line = ''
          } else if ((chr0 === '*' || chr0 === '.') && (!inBlock || listStack.length) && (m = line.match(ListItemRx))) {
            const [, marker, text] = m
            subs = NORMAL_SUBS
            const ordered = marker.charAt() === '.'
            let list
            if (listStack.length) {
              const siblingIdx = listStack.findIndex(({ marker: candidate }) => candidate === marker)
              if (~siblingIdx) listStack = listStack.slice(0, siblingIdx + 1)
              list = listStack[listStack.length - 1]
            }
            if (!list || marker !== list.marker) {
              listStack.push((list = ordered ? { marker, numeral: 0, indent: '   ' } : { marker, indent: '  ' }))
            }
            indent = listStack.slice(0, -1).reduce((accum, { indent: add }) => accum + add, '')
            inBlock = true
            line = ordered ? `${(list.numeral += 1)}. ${text}` : `* ${text}`
          } else if (inBlock) {
            if (chr0 === ' ' && outdent != null) {
              line = line.slice(outdent)
            } else {
              subs = NORMAL_SUBS
            }
          } else if (chr0 === '.') {
            const chr1 = line.charAt(1)
            if (chr1) {
              subs = NORMAL_SUBS
              line = chr1 === '*' ? line.slice(1) : `*${line.slice(1)}*`
            }
          } else if (line === 'toc::[]' || (chr0 === ':' && (m = line.match(AttributeEntryRx)))) {
            line = undefined
          } else if (chr0 === ' ') {
            outdent = line.length - line.trimStart().length
            if (line.charAt(outdent) === '$' && line.charAt(outdent + 1) === ' ') {
              accum.push((cap = '```') + 'console')
            } else {
              indent = '    '
            }
            inBlock = true
            line = line.slice(outdent)
          } else if (chr0 === '<' && CONUMS[line.charAt(1)]) {
            subs = NORMAL_SUBS
            line = line.slice(1).replace('>', '.')
          } else if (chr0 === chr0.toUpperCase() && ~line.indexOf(': ') && (m = line.match(AdmonitionLabelRx))) {
            subs = NORMAL_SUBS
            const label = m[1]
            inBlock = true
            line = `${ADMONITION_EMOJI[label]} *${label}:*${line.slice(label.length + 1)}`
          } else {
            subs = NORMAL_SUBS
            inBlock = true
          }
        } else {
          if (accum[accum.length - 1] === '') line = undefined
          inBlock = inHeader = false
          if (cap) accum.push(cap)
          cap = indent = outdent = undefined
          listStack = []
        }
        if (line !== undefined) {
          if (line) {
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
    .concat(cap ? '\n' + cap : '')
    .replace(RewriteInternalXrefRx, (_, text, id) => {
      const { title = id, autoId = id } = refs[id] || {}
      return `[${text || title}](#${autoId})`
    })
    .trimEnd()
}

function quotes (str) {
  return str
    .replace(/(?:\[[^[\]]+\]|)(?<!\\)\*(\S|\S.*?\S)\*/g, '**$1**')
    .replace(/(?:\[[^[\]]+\]|)\b(?<!\\)_(\S|\S.*?\S)_(?=\b)/g, '*$1*')
    .replace(/`\\/g, '`')
}

function macros (str) {
  return str
    .replace(MacroRx, (_, img = '', scheme = '', target, text) => {
      return `${img && '!'}[${text.split(',')[0] || scheme + target}](${scheme + target})`
    })
    .replace(XrefRx, (_, _id, _text = '', id = _id, text = _text) => {
      return ExternalXrefTargetRx.test(id) ? `[${text}](${id.replace(TrailingHashRx, '')})` : `!![${text}](#${id})`
    })
}

function replaceAttributeReferences (str) {
  return str && ~str.indexOf('{') ? str.replace(AttributeReferenceRx, replaceAttributeReference.bind(this)) : str
}

function replaceAttributeReference (match, name) {
  if (match.charAt() === '\\') return match.slice(1)
  return name in this ? this[name] : match
}

module.exports = downdoc
