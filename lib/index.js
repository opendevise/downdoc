'use strict'

const ADMONITION_ICONS = {
  CAUTION: '\ud83d\udd25',
  IMPORTANT: '\u2757',
  NOTE: '\ud83d\udccc',
  TIP: '\ud83d\udca1',
  WARNING: '\u26a0\ufe0f',
}
const BLOCK_DELIMS = { '----': 'verbatim', '....': 'verbatim', '====': true, '****': true, ____: true, '|===': true }
const CONUMS = [undefined, '\u2776', '\u2777', '\u2778', '\u2779', '\u277a', '\u277b', '\u277c', '\u277d', '\u277e']
const DEFAULT_ATTRS = { empty: '', idprefix: '_', idseparator: '_', nbsp: '&#160;', sp: ' ', vbar: '|' }
const LIST_MARKERS = { '*': true, '.': true, '-': true }
const NORMAL_SUBS = ['quotes', 'attributes', 'macros']

const AdmonitionLabelRx = new RegExp(`^(${Object.keys(ADMONITION_ICONS).join('|')}):(?=\\s)`)
const AttributeEntryRx = /^:([^:]+):(?:$| (.+))/
const AttributeReferenceRx = /\\?\{([a-z0-9_-]+)\}/g
const AuthorInfoLineRx = /^(?:[\p{Alpha}0-9_]+(?: +[\p{Alpha}0-9_]+){0,2}(?: +<([^>]+)>)?(?:; |$))+$/u
const BlockAnchorRx = /^\[([^,]+)(?:, *(.+))?\]$/
const BlockImageMacroRx = /^image::([^\s[]+)\[(.*)\]$/
const CellDelimiterRx = /(?:^| *)[a-z]?\| */
const ConditionalDirectiveRx = /^if(n)?def::([^[]+)\[(.+)?\]$/
const ConumRx = /(^| )<([1-9])>$/
const DlistItemRx = /^(?!\/\/)(\S.*?)::(?:\s+(.+))?/
const ElementAttributeRx = /(?:^|, *)(?:(\w[\w-]*)=)?(?:("|')([^\2]*)\2|([^,]+|))/g
const ExternalXrefTargetRx = /\.adoc$|#/
const LinkMacroRx = /(?:link:|(https?:\/\/))([^\s[\\]+)\[(|.*?[^\\])\]|\\(https?:)(\/\/[^\s[\]]+)(?=\s|$)/g
const ListItemRx = /^(\*+|\.+|-(?! -)) (\S.*)/s
const InlineImageMacroRx = /image:(?!:)([^\s[\\]+)\[(|.*?[^\\])\]/g
const RevisionInfoLineRx = /^v(\d+(?:[-.]\w+)*)(?:, (\d+-\d+-\d+))?|(\d+-\d+-\d+)$/
const RewriteInternalXrefRx = /!!\[(|.*?[^\\])\]\(#([^)]+)\)/g
const SectionTitleRx = /^(=+) (\S.*)/
const StyleShorthandRx = /(^|[.#%])([^.#%]+)/g
const TrailingHashRx = /#$/
const XrefRx = /xref:#?([^\s[\\]+)\[(|.*?[^\\])\]|<<#?([^,<>]+)(?:, ?([^<>]+))?>>/g

function downdoc (asciidoc, { attributes } = {}) {
  const attrs = Object.assign({}, DEFAULT_ATTRS, (attributes ??= {}))
  delete attrs.doctitle
  const convertInline = { attributes: replaceAttributeReferences.bind(attrs), macros, quotes }
  const lines = asciidoc.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  const containerStack = []
  let inContainer = false
  let inHeader = asciidoc.charCodeAt() === 61 || (~asciidoc.indexOf('\n= ') ? true : false) // eslint-disable-line
  let inPara = false
  let inTable = false
  const fixedListIndent = parseInt(attrs['markdown-list-indent'], 10) || undefined
  const collapsibleVariantSpoiler = attrs['markdown-collapsible-variant'] === 'spoiler'
  const listStack = Object.defineProperty([], 'indent', {
    get: () => (listStack.length ? listStack.reduce((accum, { indent }) => accum + indent, '') : ''),
  })
  const refs = {}
  let blockAttrs, blockTitle, cap, hardbreak, indent, outdent, skipping, subs, match
  return lines
    .reduce((accum, line) => {
      while (true) {
        if (skipping) {
          if (skipping === line) skipping = undefined
          line = undefined
        } else if (inContainer.verbatim === true) {
          if (line === inContainer.delimiter) {
            inContainer = false
            line = '```'
          } else if (line.length > 2 && line[line.length - 1] === '>') {
            line = line.replace(ConumRx, (_, leadingSpace, conum) => leadingSpace + CONUMS[conum])
          }
        } else if (!inHeader && line in BLOCK_DELIMS) {
          if (BLOCK_DELIMS[line] === 'verbatim') {
            if (inContainer !== false) containerStack.push(inContainer)
            inContainer = { delimiter: line, verbatim: true }
            inPara = false
            let style, lang
            if (blockAttrs || (line === '----' && 'source-language' in attrs)) {
              blockAttrs = blockAttrs ? parseAttrlist(blockAttrs) : new Map().set(1, 'source')
              if ((style = blockAttrs.get(1) || (line === '----' ? 'source' : 'literal')) === 'source') {
                lang = blockAttrs.get(2) || attrs['source-language']
              } else if (line === '....' && style !== 'listing' && style !== 'literal') {
                lang = style
              }
              if (blockAttrs.get('subs')?.includes('attributes')) subs = ['attributes']
              blockAttrs = undefined
            }
            line = '```' + (lang || '')
          } else if (line === inContainer.delimiter) {
            line = inContainer.cap || undefined
            inPara = inTable = false
            blockAttrs = blockTitle = undefined
            inContainer = containerStack.length ? containerStack.pop() : false
          } else {
            if (inContainer !== false) containerStack.push(inContainer)
            inContainer = { delimiter: line, verbatim: false }
            inPara = false
            if (line === '|===') {
              inTable = {}
              const cols = (blockAttrs = parseAttrlist(blockAttrs)).get('cols')
              if (cols) inTable.cols = ~cols.indexOf('*') ? parseInt(cols, 10) : cols.split(/[,;]/).length
              line = undefined
            } else if (line === '====' && (blockAttrs = parseAttrlist(blockAttrs)).has('collapsible-option')) {
              if (collapsibleVariantSpoiler) {
                line = '```spoiler' + (blockTitle ? ' ' + blockTitle.text : '')
                inContainer.cap = '```'
              } else {
                line = `<details>\n${indent || ''}<summary>${blockTitle?.text || 'Details'}</summary>\n`
                inContainer.cap = '</details>'
              }
              blockTitle = undefined
            } else {
              line = blockTitle = undefined
            }
            blockAttrs = undefined
          }
        } else if (line.length) {
          subs = undefined
          const chr0 = line[0]
          if (inPara === undefined) {
            if ((chr0 in LIST_MARKERS && ListItemRx.test(line)) || isDlistItem(line)) {
              accum.pop()
            } else {
              indent = undefined
              listStack.splice(0)
            }
            inPara = false
          }
          if (chr0 === '/' && line[1] === '/') {
            if (line === '////') inPara = !(skipping = '////')
            line = undefined
          } else if (chr0 === 'i' && ~line.indexOf('def::') && (match = ConditionalDirectiveRx.exec(line))) {
            const [, negated, name, text] = match
            skipping = (name in attrs ? negated : !negated) ? 'endif::[]' : false
            if (text) {
              line = skipping ? undefined : text
              skipping = undefined
              if (line) continue // reprocess line
            }
            line = undefined
          } else if (line === 'endif::[]' && skipping === false) {
            line = skipping = undefined
          } else if (chr0 === '=' && inContainer === false && !inPara && (match = SectionTitleRx.exec(line))) {
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
            let id = (blockAttrs = parseAttrlist(blockAttrs)).get('id')
            if (!(id == null && inHeader)) {
              id ??= attrs.idprefix + titleWords.join(attrs.idseparator).toLowerCase()
              refs[id] = { autoId: titleWords.join('-').toLowerCase(), title: blockAttrs.get('reftext') || title }
            }
            blockTitle = undefined
            line = '#'.repeat(marker.length) + ' ' + title
          } else if (chr0 === ':' && !inPara && (match = AttributeEntryRx.exec(line))) {
            const [, name, value = ''] = match
            if (!(name in attributes)) attrs[name] = convertInline.attributes(value)
            line = undefined
          } else if (chr0 === '[' && line[line.length - 1] === ']') {
            blockAttrs = line.slice(1, -1)
            inPara = false
            line = undefined
          } else if (inHeader) {
            if ((inHeader = 'doctitle' in attrs)) {
              if (!('author' in attrs) && AuthorInfoLineRx.test(line)) {
                const authors = line.split('; ').map((it) => it.split(' <')[0])
                Object.assign(attrs, { author: authors[0], authors: authors.join(', ') })
              } else if (!('revdate' in attrs) && !('revnumber' in attrs) && (match = RevisionInfoLineRx.exec(line))) {
                const [, revnumber, revdate_, revdate = revdate_] = match
                Object.assign(attrs, revnumber && { revnumber }, revdate && { revdate })
              } else {
                inHeader = false
              }
            }
            if (!inHeader && !accum.length) continue // reprocess line
            line = undefined
          } else if (inTable) {
            subs = NORMAL_SUBS
            const currentRow = inTable.currentRow
            const [appendToLast, ...cells] = line.split(CellDelimiterRx)
            if (currentRow) {
              if (appendToLast) {
                if (currentRow.length) {
                  const lastCell = currentRow.pop()
                  currentRow.push(lastCell ? `${lastCell} ${appendToLast}` : appendToLast)
                } else {
                  const lastLine = accum.pop().slice(0, -2).trimEnd()
                  accum.push(`${lastLine} ${applySubs.call(convertInline, appendToLast, subs)} |`)
                }
              }
              if (currentRow.push(...cells) < inTable.cols) {
                line = undefined
              } else {
                line = `| ${currentRow.splice(0, inTable.cols).join(' | ')} |`
              }
            } else {
              inTable.currentRow = []
              if ((inTable.cols ||= cells.length) !== cells.length) {
                accum.push(`${'|     '.repeat(inTable.cols)}|\n${'| --- '.repeat(inTable.cols)}|`)
                continue // reprocess line
              }
              line = `| ${cells.join(' | ')} |\n${'| --- '.repeat(inTable.cols)}|`
            }
          } else if (line === '+' && listStack.length) {
            indent = listStack.indent
            inPara = false
            line = ''
          } else if (chr0 in LIST_MARKERS && (!inPara || listStack.length) && (match = ListItemRx.exec(line))) {
            const [, marker, text] = match
            subs = NORMAL_SUBS
            const ordered = marker[0] === '.'
            let list
            if (listStack.length) {
              const siblingIdx = listStack.findIndex(({ marker: candidate }) => candidate === marker)
              ~siblingIdx && listStack.splice(siblingIdx + 1)
              if (marker === (list = listStack[listStack.length - 1]).marker) listStack.pop()
            }
            indent = listStack.indent
            if (!list || marker !== list.marker) {
              const listIndent = ' '.repeat(fixedListIndent || (ordered ? 3 : 2))
              list = ordered ? { marker, indent: listIndent, numeral: 0 } : { marker, indent: listIndent }
            }
            listStack.push(list)
            cap && accum.push(cap) && (cap = undefined)
            inPara = true
            line = ordered ? `${(list.numeral += 1)}. ${text}` : '* ' + text
          } else if ((!inPara || listStack.length) && (match = isDlistItem(line, true))) {
            const [, term, desc] = match
            hardbreak = desc ? undefined : 'pending'
            line = `- *${term}*${desc ? '\\\n' + desc : ''}`
            continue // reprocess line
          } else if (inPara) {
            if (chr0 === ' ' && outdent != null) {
              line = line.slice(outdent)
            } else {
              subs = NORMAL_SUBS
              const lastLine = accum[accum.length - 1]
              if (lastLine) {
                if (hardbreak) {
                  accum[accum.length - 1] = lastLine + '\\'
                } else if (lastLine[lastLine.length - 1] === '+' && lastLine[lastLine.length - 2] === ' ') {
                  accum[accum.length - 1] = lastLine.slice(0, -2) + '\\'
                }
              }
            }
          } else if (chr0 === '.') {
            subs = NORMAL_SUBS
            if (line.length > 1 && !(line[1] === '.' && line[2] === '.')) {
              line = line[1] === '*' && line[line.length - 1] === '*' ? line.slice(2, -1) : line.slice(1)
              blockTitle = { indent: indent || '', text: line, subs }
              line = undefined
            }
          } else if (chr0 === ' ') {
            outdent = line.length - line.trimStart().length
            indent = listStack.indent
            if (line[outdent] === '$' && line[outdent + 1] === ' ') {
              accum.push((cap = indent + '```') + 'console')
            } else {
              indent += '    '
            }
            inPara = true
            line = line.slice(outdent)
          } else if (line === 'toc::[]') {
            line = undefined
          } else if (chr0 === '<' && CONUMS[line[1]]) {
            subs = NORMAL_SUBS
            line = line.slice(1).replace('>', '.')
          } else if (chr0 === chr0.toUpperCase() && ~line.indexOf(': ') && (match = AdmonitionLabelRx.exec(line))) {
            subs = NORMAL_SUBS
            const label = match[1]
            inPara = true
            line = `${ADMONITION_ICONS[label]} *${label}:*${line.slice(label.length + 1)}`
          } else if (chr0 === 'i' && line.startsWith('image::') && (match = BlockImageMacroRx.exec(line))) {
            const [, target, text] = match
            subs = ['attributes']
            line = `![${text.split(',')[0]}](${target})`
          } else {
            if (line !== '***') subs = NORMAL_SUBS
            inPara = true
          }
        } else {
          if (inTable || !accum[accum.length - 1]) line = undefined
          inHeader = false
          inPara = listStack.length ? undefined : !!(indent = undefined)
          blockAttrs = blockTitle = outdent = undefined
          cap && accum.push(cap) && (cap = undefined)
        }
        if (line !== undefined) {
          if (blockTitle) {
            accum.push(blockTitle.indent + applySubs.call(convertInline, `*${blockTitle.text}*`, blockTitle.subs), '')
            blockTitle = undefined
          }
          if (line.length) {
            if (subs) line = applySubs.call(convertInline, line, subs)
            if (indent) line = indent + line
          }
          accum.push(line)
        }
        hardbreak &&= hardbreak === 'pending' || undefined
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

function isDlistItem (line, capture) {
  const idx = line.indexOf('::') + 2
  return idx > 2 && (idx === line.length || line[idx] === ' ') && DlistItemRx[capture ? 'exec' : 'test'](line)
}

function applySubs (str, subs) {
  return subs.reduce((accum, name) => this[name](accum), str)
}

function macros (str) {
  return str
    .replace(InlineImageMacroRx, (_, target, text) => `![${text.split(',')[0] || target.split('/').pop()}](${target})`)
    .replace(LinkMacroRx, (_, scheme = '', url, text, escProtocol, escUrl) =>
      escProtocol ? `<span>${escProtocol}</span>${escUrl}` : `[${text || scheme + url}](${scheme + url})`
    )
    .replace(XrefRx, (_, _id, _text = '', id = _id, text = _text) =>
      ExternalXrefTargetRx.test(id) ? `[${text}](${id.replace(TrailingHashRx, '')})` : `!![${text}](#${id})`
    )
}

function parseAttrlist (attrlist) {
  //if (attrlist instanceof Map) return attrlist
  const attrs = new Map().set(0, attrlist)
  if (!attrlist) return attrs
  let m
  const chr0 = attrlist[0]
  if (chr0 === '[' && (m = BlockAnchorRx.exec(attrlist))) {
    return m[2] ? attrs.set('id', m[1]).set('reftext', m[2]) : attrs.set('id', m[1])
  }
  let idx = 0
  if (~attrlist.indexOf('=') || ~attrlist.indexOf('"')) {
    while ((m = ElementAttributeRx.exec(attrlist))) {
      attrs.set(m[1] ?? ++idx, m[4] ?? m[3])
      if (m.index) continue
      attrlist = ',' + attrlist
      ElementAttributeRx.lastIndex = 1
    }
  } else if (chr0 === ',' || ~attrlist.indexOf(',')) {
    for (const it of attrlist.split(',')) attrs.set(++idx, it.trimStart())
  } else {
    attrs.set(1, attrlist)
  }
  const shorthand = attrs.get(1)
  if (!shorthand) return attrs
  attrs.set(1, undefined)
  while ((m = StyleShorthandRx.exec(shorthand))) {
    switch (m[1]) {
      //case '.':
      //  attrs.set('role', m[2])
      //  break
      case '#':
        attrs.set('id', m[2])
        break
      case '%':
        attrs.set(m[2] + '-option', '')
        break
      default:
        attrs.set(1, m[2])
    }
  }
  return attrs
}

function quotes (str) {
  return str
    .replace(/(?:\[[^[\]]+\]|)(?<!\\)\*(\S|\S.*?\S)\*/g, '**$1**')
    .replace(/"`(\S|\S.*?\S)`"/g, '<q>$1</q>')
    .replace(/`\S.*?\S`/g, (m) => m.replace(/\\(?=\S)/g, ''))
    .replace(/(?:\[[^[\]]+\]|)\b(?<!\\)_(\S|\S.*?\S)_(?=\b)/g, '_$1_')
    .replace(/(?:\[([^[\]]+)\]|)(?<!\\)#(\S|\S.*?\S)#/g, (_, attrlist, text) =>
      attrlist ? text : `<mark>${text}</mark>`
    )
    .replace(/\x60'|(?<=[\p{Alpha}0-9])'(?=\p{Alpha})/gu, '\u2019')
}

function replaceAttributeReferences (str) {
  return str && ~str.indexOf('{') ? str.replace(AttributeReferenceRx, replaceAttributeReference.bind(this)) : str
}

function replaceAttributeReference (match, name) {
  return match[0] === '\\' ? match.slice(1) : name in this ? this[name] : match
}

module.exports = downdoc
