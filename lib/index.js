'use strict'

const ADMONS = ((data) => Object.fromEntries(new Map(data.split('\n').map((it) => it.split(',')))))(
  'CAUTION,\ud83d\udd25\nIMPORTANT,\u2757\nNOTE,\ud83d\udccc\nTIP,\ud83d\udca1\nWARNING,\u26a0\ufe0f'
)
const CONUMS = [...new Array(19)].reduce((m, _, i) => (m[i + 1] = String.fromCharCode(0x2460 + i)) && m, {})
const DELIMS = { '----': 'v', '....': 'v', '====': 'c', '|===': 't', '--': 'c', '****': 'c', ____: 'c', '++++': 'p' }
const DEFAULT_ATTRS = { empty: '', idprefix: '_', idseparator: '_', nbsp: '&#160;', sp: ' ', vbar: '|' }
const LIST_MARKERS = { '*': true, '.': true, '<': true, '-': true }
const NORMAL_SUBS = ['quotes', 'attributes', 'macros']
const BREAKS = { "'''": '---', '***': '---', '---': '---', '<<<': undefined, 'toc::[]': undefined }

const AdmonitionLabelRx = new RegExp(`^(${Object.keys(ADMONS).join('|')}):(?=\\s)`)
const AttributeEntryRx = /^:([^:]+):(?:$| (.+))/
const AttributeReferenceRx = /\\?\{([a-z0-9_-]+)\}/g
const AuthorInfoLineRx = /^(?:[\p{Alpha}0-9_]+(?: +[\p{Alpha}0-9_]+){0,2}(?: +<([^>]+)>)?(?:; |$))+$/u
const BlockAnchorRx = /^\[([^,]+)(?:, *(.+))?\]$/
const BlockImageMacroRx = /^image::([^\s[]+)\[(.*)\]$/
const CellDelimiterRx = /(?:^| *)[a-z]?\| */
const ConditionalDirectiveRx = /^if(n)?def::([^[]+)\[(.+)?\]$/
const ConumRx = /(^| )<([.1-9]|1[0-9])>(?=(?: <(?:[.1-9]|1[0-9])>)*$)/g
const DlistItemRx = /^(?!\/\/)(\S.*?)::(?:\s+(.+))?/
const ElementAttributeRx = /(?:^|, *)(?:(\w[\w-]*)=)?(?:("|')([^\2]+?)\2|([^,]+|))/g
const LinkMacroRx = /(?:link:|(https?:\/\/))([^\s[\\]+)\[(|.*?[^\\])\^?\]|(\\)?((https?:\/\/)([^\s[\]]+))(?=\s|$)/g
const ListItemRx = /^(\*+|\.+|<[1-9.]>|-(?! -)) (\S.*)/s
const InlineImageMacroRx = /image:(?!:)([^\s[\\]+)\[(|.*?[^\\])\]/g
const RevisionInfoLineRx = /^v(\d+(?:[-.]\w+)*)(?:, (\d+-\d+-\d+))?|(\d+-\d+-\d+)$/
const RewriteInternalXrefRx = /!!\[(|.*?[^\\])\]\(#([^)]+)\)/g
const SectionTitleRx = /^(=+) (\S.*)/
const StyleShorthandRx = /(^|[.#%])([^.#%]+)/g
const SubsDetectorRx = /[{':<`*_#]/
const XrefRx = /xref:#?([^\s[\\]+)\[(|.*?[^\\])\]|<<#?([^,<>]+)(?:, ?([^<>]+))?>>/g

function downdoc (asciidoc, { attributes } = {}) {
  const attrs = Object.assign({}, DEFAULT_ATTRS, (attributes ??= {}))
  delete attrs.doctitle
  const lines = asciidoc.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  const containerStack = []
  const listStack = Object.defineProperty([], 'indent', { writable: true, value: '' })
  let inContainer, inHeader, inList, inPara, inTable
  inHeader = asciidoc.charCodeAt() === 61 || (~asciidoc.indexOf('\n= ') ? true : false) // eslint-disable-line
  inContainer = inPara = false
  const refs = {}
  const substitutors = { quotes, attributes: subAttributeReferences.bind(attrs), macros: macros.bind(attrs) }
  substitutors.callouts = callouts.bind({ get: (chr) => CONUMS[chr === '.' ? inContainer.autonum++ : chr] })
  let blockAttrs, blockTitle, cap, contentModel, hardbreakBeforeNext, last, match, skipping, subs, style, verbatim
  let indent = ''
  return lines
    .reduce((accum, line) => {
      while (true) {
        subs = undefined
        if (skipping) {
          line = skipping === line ? (skipping = undefined) : undefined
        } else if (inContainer.verbatim === true) {
          if (line === inContainer.delimiter) {
            line = inContainer.cap
            inContainer = containerStack.length ? containerStack.pop() : false
          } else if (line.length > 2) subs = inContainer.subs
        } else if (!line) {
          inHeader = inPara = false
          blockAttrs = blockTitle = verbatim = (indent = '').undefined
          cap && accum.push(cap) && (cap = undefined)
          if (inList) {
            inList.containerStack.length ? (indent = listStack.indent + inList.childIndent) : (inPara = undefined)
          }
          if (inTable || !accum[accum.length - 1]) line = undefined
        } else if (!inHeader && line in DELIMS) {
          if (inContainer !== (inPara = false) && line !== inContainer.delimiter) containerStack.push(inContainer)
          if ((contentModel = DELIMS[line]) === 'v') {
            inContainer = { autonum: 1, delimiter: line, verbatim: true, subs: (subs = ['callouts']) }
            let lang
            if (blockAttrs || (line === '----' && 'source-language' in attrs)) {
              blockAttrs = blockAttrs ? parseAttrlist(blockAttrs) : new Map().set(1, 'source')
              if ((style = blockAttrs.get(1) || (line === '----' ? 'source' : 'literal')) === 'source') {
                lang = blockAttrs.get(2) || attrs['source-language']
              } else if (line === '....' && style !== 'listing' && style !== 'literal') {
                lang = style
              }
              if (blockAttrs.get('subs')?.includes('attributes')) subs.push('attributes')
              blockAttrs = undefined
            }
            line = lang ? (inContainer.cap = '```') + lang : (inContainer.cap = '```')
          } else if (contentModel === 'p') {
            inContainer = { delimiter: line, verbatim: true }
            line = parseAttrlist(blockAttrs).get(1) === 'stem' ? (inContainer.cap = '```') + 'math' : undefined
            blockAttrs = blockTitle = undefined
          } else if (line === inContainer.delimiter) {
            line = inContainer.cap
            if (inList?.containerStack.length) inList.containerStack.pop()
            inTable = blockAttrs = blockTitle = undefined
            inContainer = containerStack.length ? containerStack.pop() : false
          } else {
            inContainer = { delimiter: line, verbatim: false }
            inList?.containerStack.push(inContainer)
            if (contentModel === 't') {
              inTable = {}
              const cols = (blockAttrs = parseAttrlist(blockAttrs)).get('cols')
              if (cols) inTable.cols = ~cols.indexOf('*') ? parseInt(cols, 10) : cols.split(/[,;]/).length
              line = blockAttrs = undefined
            } else if (line === '====' && !(line = undefined)) {
              if ((style = (blockAttrs = parseAttrlist(blockAttrs)).get(1)) in ADMONS) {
                line = `<dl><dt><strong>${ADMONS[style]} ${style}</strong></dt><dd>\n`
                inContainer.cap = '</dd></dl>'
              } else if (blockAttrs.has('collapsible-option')) {
                if (attrs['markdown-collapsible-variant'] === 'spoiler') {
                  line = (inContainer.cap = '```') + 'spoiler' + (blockTitle ? ' ' + blockTitle.text : '')
                } else {
                  const openAttr = blockAttrs.has('open-option') ? ' open' : ''
                  line = `<details${openAttr}>\n${indent}<summary>${blockTitle?.text || 'Details'}</summary>\n`
                  inContainer.cap = '</details>'
                }
              }
              blockAttrs = blockTitle = undefined
            } else {
              line = blockAttrs = blockTitle = undefined
            }
          }
        } else {
          const chr0 = line[0]
          if (inPara === undefined && !(inPara = false) && chr0 !== ' ') {
            ;(chr0 in LIST_MARKERS && ListItemRx.test(line)) || isDlistItem(line)
              ? accum.pop()
              : listStack.splice((inList = (listStack.indent = indent = '').undefined))
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
          } else if (!inPara && chr0 === '=' && (match = SectionTitleRx.exec(line))) {
            let discrete, id, titleWords
            if ((discrete = (blockAttrs = parseAttrlist(blockAttrs)).get(1) === 'discrete') || inContainer === false) {
              let [, marker, title] = match
              if (inHeader) {
                if (marker.length > 1 || discrete || 'doctitle' in attrs) {
                  inHeader = false
                  if (accum.length) return accum
                  continue // reprocess line
                }
                attrs.doctitle = title
                if ((id = blockAttrs.get('id'))) titleWords = title.toLowerCase().split(' ')
              } else {
                titleWords = (title = substitutors.attributes(title)).toLowerCase().split(' ')
                id = blockAttrs.get('id') || attrs.idprefix + titleWords.join(attrs.idseparator)
              }
              if (id) refs[id] = { autoId: titleWords.join('-'), title: blockAttrs.get('reftext') || title }
              blockAttrs = blockTitle = undefined
              line = '#'.repeat(marker.length) + ' ' + title
            } else {
              subs = NORMAL_SUBS
              inPara = true
            }
          } else if (!inPara && chr0 === ':' && (match = AttributeEntryRx.exec(line))) {
            const [, name, value = ''] = match
            if (!(name in attributes)) attrs[name] = value && substitutors.attributes(value)
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
            const [wrapped, ...cells] = line.split(CellDelimiterRx)
            if (currentRow) {
              if (wrapped) {
                if (currentRow.length) {
                  currentRow.push((last = currentRow.pop()) ? `${hardbreak(last, '<br>')} ${wrapped}` : wrapped)
                } else {
                  const replacement = hardbreak((last = accum.pop().split('\n'))[0].slice(0, -2).trimEnd(), '<br>')
                  last[0] = `${replacement} ${applySubs.call(substitutors, wrapped, subs)} |`
                  accum.push(last.join('\n'))
                }
              }
              const cols = inTable.cols
              line = currentRow.push(...cells) < cols ? undefined : `| ${currentRow.splice(0, cols).join(' | ')} |`
            } else {
              inTable.currentRow = []
              if ((inTable.cols ||= cells.length) !== cells.length) {
                accum.push(['|     ', '| --- '].map((it) => `${indent}${it.repeat(inTable.cols)}|`).join('\n'))
                continue // reprocess line
              }
              line = `| ${cells.join(' | ')} |\n${indent}${'| --- '.repeat(inTable.cols)}|`
            }
          } else if (line === '+' && inList) {
            indent = listStack.indent + inList.childIndent
            cap && accum.push(cap) && (cap = undefined)
            inPara = false
            line = ''
          } else if ((!inPara || inList) && chr0 in LIST_MARKERS && (match = ListItemRx.exec(line))) {
            let [, marker, text] = match
            subs = NORMAL_SUBS
            const ordered = marker[0] === '.' || (marker[0] === '<' && (marker = '<.>') && true)
            if (inList) {
              listStack.push(inList)
              const siblingIdx = listStack.findIndex((it) => it.marker === marker)
              if (~siblingIdx) listStack.splice(siblingIdx + 1)
              if (marker === (inList = listStack[listStack.length - 1]).marker) listStack.pop()
              listStack.indent = listStack.length ? listStack.reduce((buf, it) => buf + it.childIndent, '') : ''
            }
            if (!inList || inList.marker !== marker) {
              const childIndent = ' '.repeat(parseInt(attrs['markdown-list-indent'], 10) || (ordered ? 3 : 2))
              inList = { marker, childIndent, containerStack: [], numeral: ordered ? 0 : undefined }
            }
            indent = listStack.indent
            cap && accum.push(cap) && (cap = undefined)
            inPara = true
            line = ordered ? `${(inList.numeral += 1)}. ${text}` : '* ' + text
          } else if ((!inPara || inList) && (match = isDlistItem(line, true))) {
            const [, term, desc] = match
            hardbreakBeforeNext = desc ? undefined : 'pending'
            line = `- *${term}*${desc ? '\\\n' + desc : ''}`
            continue // reprocess line
          } else if (inPara) {
            subs = NORMAL_SUBS
            if (verbatim && chr0 === ' ') {
              subs = verbatim.subs
              line = line.slice(verbatim.outdent)
            } else if (hardbreakBeforeNext) {
              accum[accum.length - 1] += '\\'
            } else if ((last = accum[accum.length - 1]) && (last = hardbreak(last, '\\', undefined))) {
              accum[accum.length - 1] = last
            }
          } else if (chr0 === '.') {
            subs = NORMAL_SUBS
            if (line.length > 1 && !(line[1] === '.' && line[2] === '.')) {
              const text = line[1] === '*' && line[line.length - 1] === '*' ? line.slice(2, -1) : line.slice(1)
              blockTitle = { indent, text, subs }
              line = undefined
            }
          } else if (chr0 === ' ') {
            indent = inList ? listStack.indent + inList.childIndent : ''
            if (blockAttrs && parseAttrlist(blockAttrs).get('subs')?.includes('attributes')) subs = ['attributes']
            verbatim = { outdent: line.length - line.trimStart().length, subs }
            line = (inPara = true) && line.slice(verbatim.outdent)
            if (line[0] === '$' && line[1] === ' ') {
              cap = indent + '```'
              line = '```console\n' + indent + line
            } else {
              indent += '    '
            }
          } else if (chr0 === chr0.toUpperCase() && ~line.indexOf(': ') && (match = AdmonitionLabelRx.exec(line))) {
            subs = NORMAL_SUBS
            inPara = true
            line = `*${ADMONS[(style = match[1])]} ${style}*${line.slice(style.length + 1)}`
          } else if (chr0 === 'i' && line.startsWith('image::') && (match = BlockImageMacroRx.exec(line))) {
            subs = ['attributes']
            line = image.apply(attrs, match.slice(1))
          } else if (line in BREAKS) {
            line = BREAKS[line]
          } else {
            subs = NORMAL_SUBS
            inPara = true
          }
        }
        if (line === undefined) return accum
        if (blockTitle) {
          accum.push(blockTitle.indent + applySubs.call(substitutors, `*${blockTitle.text}*`, blockTitle.subs), '')
          blockTitle = undefined
        }
        if (line) {
          if (subs && !(line = applySubs.call(substitutors, line, subs)) && !accum.length) return accum
          if (indent && line) line = indent + line
        }
        hardbreakBeforeNext &&= hardbreakBeforeNext === 'pending' || undefined
        accum.push(line)
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

function applySubs (str, subs) {
  return SubsDetectorRx.test(str) ? subs.reduce((accum, name) => this[name](accum), str) : str
}

function callouts (str) {
  return str[str.length - 1] === '>' ? str.replace(ConumRx, (_, space, num) => space + this.get(num)) : str
}

function hardbreak (line, mark, ifAbsent = line) {
  return line[line.length - 1] === '+' && line[line.length - 2] === ' ' ? line.slice(0, -2) + mark : ifAbsent
}

function image (target, text) {
  return `![${text.split(',')[0] || target.split('/').pop()}](${(this.imagesdir ? this.imagesdir + '/' : '') + target})`
}

function isDlistItem (line, capture, idx = line.indexOf('::') + 2) {
  return idx > 2 && (idx === line.length || line[idx] === ' ') && DlistItemRx[capture ? 'exec' : 'test'](line)
}

function macros (str) {
  return str
    .replace(InlineImageMacroRx, (_, target, text) => image.call(this, target, text))
    .replace(LinkMacroRx, (_, scheme = '', url, text, esc, bareUrl, bareScheme, bareUrlWithoutScheme) => {
      if (!bareUrl) return `[${text || (this['hide-uri-scheme'] == null ? scheme : '') + url}](${scheme + url})`
      if (esc) return `<span>${bareScheme}</span>${bareUrlWithoutScheme}`
      return this['hide-uri-scheme'] == null ? bareUrl : `[${bareUrlWithoutScheme}](${bareUrl})`
    })
    .replace(XrefRx, (_, _id, _text = '', id = _id, text = _text) =>
      ~id.indexOf('#') || id.endsWith('.adoc') ? `[${text}](${id.replace(/#$/, '')})` : `!![${text}](#${id})`
    )
}

function parseAttrlist (attrlist) {
  if (!attrlist) return new Map()
  if (attrlist instanceof Map) return attrlist
  const attrs = new Map().set(0, attrlist)
  let chr0, m, shorthand, style
  if ((chr0 = attrlist[0]) === '[' && (m = BlockAnchorRx.exec(attrlist))) {
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
  if (!(shorthand = attrs.get(1))) return attrs
  while ((m = StyleShorthandRx.exec(shorthand))) {
    switch (m[1]) {
      case '.':
        attrs.set('role', m[2])
        break
      case '#':
        attrs.set('id', m[2])
        break
      case '%':
        attrs.set(m[2] + '-option', '')
        break
      default:
        style = m[2]
    }
  }
  attrs.set(1, style)
  return attrs
}

function quotes (str) {
  return str
    .replace(/(?:\[[^[\]]+\]|)(?<!\\)\*(\S|\S.*?\S)\*/g, '**$1**')
    .replace(/"`(\S|\S.*?\S)`"/g, '<q>$1</q>')
    .replace(/`\S.*?\S`/g, (m) => m.replace(/\\(?=\S)/g, ''))
    .replace(/(?:\[[^[\]]+\]|)\b(?<!\\)_(\S|\S.*?\S)_(?=\b)/g, '_$1_')
    .replace(/(?<![\p{Alpha}0-9&\\\]])(?:\[([^[\]]+)\]|)#(\S|\S.*?\S)#(?![\p{Alpha}0-9])/gu, (_, attrlist, text) =>
      attrlist ? (attrlist === '.line-through' ? `~~${text}~~` : text) : `<mark>${text}</mark>`
    )
    .replace(/\x60'|(?<=[\p{Alpha}0-9])'(?=\p{Alpha})/gu, '\u2019')
}

function subAttributeReferences (str) {
  return ~str.indexOf('{') ? str.replace(AttributeReferenceRx, subAttributeReference.bind(this)) : str
}

function subAttributeReference (match, name) {
  return match[0] === '\\' ? match.slice(1) : name in this ? this[name] : match
}

module.exports = downdoc
