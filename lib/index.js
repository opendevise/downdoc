'use strict'

const ADMONS = ((data) => Object.fromEntries(new Map(data.split('\n').map((it) => it.split(',')))))(
  'CAUTION,\ud83d\udd25\nIMPORTANT,\u2757\nNOTE,\ud83d\udccc\nTIP,\ud83d\udca1\nWARNING,\u26a0\ufe0f'
)
const ATTRIBUTES = { empty: '', idprefix: '_', idseparator: '_', nbsp: '&#160;', sp: ' ', vbar: '|', zwsp: '&#8203;' }
const BREAKS = { "'''": '---', '***': '---', '---': '---', '<<<': undefined, 'toc::[]': undefined }
const CONUMS = [...Array(19)].reduce((m, _, i) => (m[i + 1] = String.fromCharCode(0x2460 + i)) && m, {})
const DELIMS = { '----': 'v', '....': 'v', '====': 'c', '|===': 't', '--': 'c', '****': 'c', ____: 'c', '++++': 'p' }
const LIST_MARKERS = { '*': true, '.': true, '<': true, '-': true }
const NORMAL_SUBS = ['quotes', 'attributes', 'macros']

const AttributeEntryRx = /^:([^:]+):(?:$| (.+))/
const AttributeReferenceRx = /(\\)?\{([\p{Ll}0-9_-]+)\}/gu
const AuthorInfoLineRx = /^(?:[\p{Alpha}0-9_]+(?: +[\p{Alpha}0-9_]+){0,2}(?: +<([^>]+)>)?(?:; |$))+$/u
const BlockAnchorRx = /^\[([^,]+)(?:, *(.+))?\]$/
const BlockImageMacroRx = /^image::([^\s[]+)\[(.*)\]$/
const CellDelimiterRx = /(?:^| *)[a-z]?\| */
const ConditionalDirectiveRx = /^if(n)?def::([^[]+)\[(.+)?\]$/
const ConumRx = /(^| )<([.1-9]|1[0-9])>(?=(?: <(?:[.1-9]|1[0-9])>)*$)/g
const DlistItemRx = /^(?!\/\/)(\S.*?)::(?:\s+(.+))?($)/
const ElementAttributeRx = /(?:^|, *)(?:(\w[\w-]*)=)?(?:("|')([^\2]+?)\2|([^,]+|))/g
const InlineAnchorRx = /\[\[([\p{Alpha}_:][\p{Alpha}0-9_\-.:]*)\]\]/u
const LinkMacroRx = /(?:link:(?!:)|(https?:\/\/))([^\s[\\]+)\[(|.*?[^\\])\^?\]|(\\)?((https?:\/\/)([^\s[\]]+))(?=\s|$)/g
const ListItemRx = /^(\*+|\.+|<[1-9.]>|-(?! -)) (\S.*)/s
const InlineImageMacroRx = /image:(?!:)([^\s[\\]+)\[(|.*?[^\\])\]/g
const RevisionInfoLineRx = /^v(\d+(?:[-.]\w+)*)(?:, (\d+-\d+-\d+))?|(\d+-\d+-\d+)$/
const RewriteInternalXrefRx = /\[(|.*?[^\\])\]\(#!([^)]+)\)/g
const StyleShorthandRx = /(?:^|([.#%]))([^.#%]+)/g
const XrefMacroRx = /(\\)?xref:(?!:)(?:([^\s#[\\]+?)(?:#|(\.adoc|#[^\s[\\]+?))|#?([^\s[\\]+?))\[(|.*?[^\\])\]/g
const XrefShorthandRx = /<<([^\s,>]+)(?:, ?([^>]+))?>>/g

module.exports = function downdoc (asciidoc, { attributes: initialAttributes } = {}) {
  const attrs = Object.assign({}, ATTRIBUTES, (initialAttributes ??= {}))
  delete attrs.doctitle
  const lines = asciidoc.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  let inContainer, inHeader, inList, inPara, inTable
  inHeader = (inContainer = inPara = false) || asciidoc[0] === '=' || !!~asciidoc.indexOf('\n= ')
  const refs = {}
  const substitutors = { quotes, attributes: attributes.bind(attrs), macros: macros.bind(attrs) }
  substitutors.callouts = callouts.bind({ get: (chr) => CONUMS[chr === '.' ? inContainer.coseq++ : chr] })
  let blockAttrs, blockTitle, grab, hardbreakAtNext, indent, match, skipping, subs, style, verbatim
  const containerStack = []
  let listStack = (indent = '') || []
  return lines
    .reduce((accum, line, idx) => {
      while (true) {
        grab = match = style = subs = undefined
        if (skipping) {
          line = skipping === line ? (skipping = undefined) : undefined
        } else if (inContainer.verbatim) {
          if (line === inContainer.delimiter) {
            ;({ cap: line, indent, inList, listStack } = inContainer)
            inContainer = containerStack.length ? containerStack.pop() : false
          } else if (line.length > 2 && (~line.indexOf('{') || line[line.length - 1] === '>')) subs = inContainer.subs
        } else if (!line) {
          inHeader = inPara = false
          inList ? (inPara = undefined) : (line = indent = inContainer.childIndent || '') && (line = line.trimEnd())
          blockAttrs = blockTitle = verbatim = verbatim?.close()
          return inTable || !accum[accum.length - 1] ? accum : accum.push(line) && accum
        } else if (!inHeader && line in DELIMS) {
          if (inPara !== false) inPara = !listStack.splice(inList = (indent = inContainer.childIndent || '').undefined)
          const opening = inContainer === false || (line !== inContainer.delimiter && containerStack.push(inContainer))
            ? (inContainer = { delimiter: line, indent, childIndent: indent, inList, listStack }) && true
            : undefined
          if ((grab = DELIMS[line]) === 'v') {
            Object.assign(inContainer, { coseq: 1, subs: ['callouts'], verbatim: true })
            if (blockAttrs || (line === '----' && 'source-language' in attrs)) {
              blockAttrs ??= new Map().set(1, 'source')
              if ((style = blockAttrs.get(1) || (line === '----' ? 'source' : 'literal')) === 'source') {
                style = blockAttrs.get(2) || attrs['source-language']
              } else if (line === '----' || style === 'listing' || style === 'literal') {
                style = undefined
              }
              blockTitle && (blockTitle.id = blockAttrs.get('id'))
              if (blockAttrs.get('subs')?.includes('attributes')) inContainer.subs = ['callouts', 'attributes']
              blockAttrs = undefined
            }
            line = style ? (inContainer.cap = '```') + style : (inContainer.cap = '```')
          } else if (grab === 'p') {
            inContainer.verbatim = true
            line = blockAttrs && blockAttrs.get(1) === 'stem' ? (inContainer.cap = '```') + 'math' : undefined
            blockAttrs = blockTitle = undefined
          } else if (opening === undefined) {
            ;({ cap: line, indent, inList, listStack } = inContainer)
            inTable = blockAttrs = blockTitle = undefined
            inContainer = containerStack.length ? containerStack.pop() : false
          } else if (grab === 't' && (inTable = {})) {
            blockAttrs && (grab = blockAttrs.get('cols')) && (inTable.cols = ~grab.indexOf('*')
              ? grab.split(/,|;/).reduce((num, col) => num + (~col.indexOf('*') ? parseInt(col, 10) : 1), 0)
              : grab.split(/,|;/).length)
            if (blockAttrs && blockAttrs.has('header-option')) inTable.header = true
            line = blockAttrs = undefined
          } else if (line === '____') {
            indent = inContainer.childIndent += '> '
            if ((grab = blockAttrs && blockAttrs.get(2))) inContainer.cap = '>\n' + indent + '\u2014 ' + grab
            line = blockAttrs = blockTitle = undefined
          } else if (line === '====' && blockAttrs && !(line = undefined)) {
            if ((style = blockAttrs.get(1)) in ADMONS) {
              line = '<dl><dt><strong>' + ADMONS[style] + ' ' + style + '</strong></dt><dd>\n'
              inContainer.cap = '</dd></dl>'
            } else if (blockAttrs.has('collapsible-option')) {
              if (attrs['markdown-collapsible-variant'] === 'spoiler') {
                line = (inContainer.cap = '```') + 'spoiler' + (blockTitle ? ' ' + blockTitle.text : '')
              } else {
                const openTag = blockAttrs.has('open-option') ? '<details open>' : '<details>'
                line = openTag + '\n' + indent + '<summary>' + (blockTitle?.text || 'Details') + '</summary>\n'
                inContainer.cap = '</details>'
              }
            }
            blockAttrs = blockTitle = undefined
          } else {
            line = blockAttrs = blockTitle = undefined
          }
          if (opening) inList = (listStack = []).undefined
        } else {
          const chr0 = line[0]
          if (inPara === undefined && !(inPara = false) && chr0 !== ' ') {
            ;(chr0 in LIST_MARKERS && ListItemRx.test(line)) || isDlistItem(line)
              ? accum.pop()
              : listStack.splice(inList = (indent = inContainer.childIndent || '').undefined)
          }
          if (chr0 === '/' && line[1] === '/') {
            if (line === '////') inPara = !(skipping = '////')
            line = undefined
          } else if (chr0 === 'i' && ~line.indexOf('def::') && (match = ConditionalDirectiveRx.exec(line))) {
            const [, negated, name, text] = match
            skipping = (name in attrs ? negated : !negated) ? 'endif::[]' : false
            if (text) {
              if (!skipping && (line = (skipping = undefined) || text)) continue // reprocess line
              skipping = undefined
            }
            line = undefined
          } else if (line === 'endif::[]' && skipping === false) {
            line = skipping = undefined
          } else if (!inPara && chr0 === '=' && (match = isHeading(line, inContainer === false, blockAttrs))) {
            let [marker, title, id, titleWords] = match
            if (inHeader) {
              if (marker.length > 1 || (blockAttrs && blockAttrs.get(1) === 'discrete') || 'doctitle' in attrs) {
                if (!(inHeader = false) && accum.length) return accum
                continue // reprocess line
              }
              attrs.doctitle = title
              if ((id = blockAttrs?.get('id'))) titleWords = title.toLowerCase().split(' ')
            } else {
              titleWords = (title = substitutors.attributes(title)).toLowerCase().split(' ')
              id = blockAttrs?.get('id') || attrs.idprefix + titleWords.join(attrs.idseparator)
            }
            if (id) refs[id] = { autoId: titleWords.join('-'), title: blockAttrs?.get('reftext') || title }
            blockAttrs = blockTitle = undefined
            line = '#'.repeat(marker.length) + ' ' + title
          } else if (!inPara && chr0 === ':' && (match = AttributeEntryRx.exec(line))) {
            const [, name, value = ''] = match
            if (!(name in initialAttributes)) attrs[name] = value && substitutors.attributes(value)
            line = undefined
          } else if (chr0 === '[' && line[line.length - 1] === ']') {
            blockAttrs = parseAttrlist(line.slice(1, -1), blockAttrs)
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
            const row = inTable.currentRow
            const [wrapped, ...cells] = line.split(CellDelimiterRx)
            if (row) {
              if (wrapped) {
                if (row.length && (inTable.hasWrappedRow = true)) {
                  row.push(((grab = row.pop())) ? hardbreak(grab, '\\\n') + ' ' + wrapped : wrapped) // prettier-ignore
                } else {
                  const opened = (grab = accum.pop().split('\n'))[0].slice(0, -2).trimEnd()
                  grab[0] = hardbreak(opened, '<br>') + ' ' + applySubs.call(substitutors, wrapped, NORMAL_SUBS) + ' |'
                  accum.push(grab.length > 1 ? grab.join('\n') : grab[0])
                }
              }
              if (row.push(...cells) < inTable.cols) return accum
              line = applySubs.call(substitutors, '| ' + row.splice(0, inTable.cols).join(' | ') + ' |', NORMAL_SUBS)
              if (inTable.hasWrappedRow && ~line.indexOf('\\\n')) line = line.replace(/\\\n/g, '<br>')
            } else {
              inTable.currentRow = []
              const cols = (inTable.cols ??= cells.length)
              if (!(inTable.header ??= cols === cells.length && lines[idx + 1] === '')) {
                accum.push(['|     ', '| --- '].map((it) => indent + it.repeat(cols) + '|').join('\n'))
                continue // reprocess line
              }
              subs = NORMAL_SUBS
              line = '| ' + cells.join(' | ') + ' |\n' + indent + '| --- '.repeat(cols) + '|'
            }
          } else if (line === '+' && inList) {
            indent = inList.childIndent
            verbatim = verbatim?.close()
            inPara = false
            line = ''
          } else if ((!inPara || inList) &&
              (chr0 in LIST_MARKERS ? (match = ListItemRx.exec(line)) : (match = isDlistItem(line, true)))) {
            let [, marker, text] = match
            if (match.length === 4) {
              (blockAttrs && blockAttrs.get(1) === 'qanda') || (inList && inList.marker === '.')
                ? (text = '_' + marker + '_') && (marker = '.')
                : (text = '*' + marker + '*') && (marker = '-')
              hardbreakAtNext = match[2] ? (text += '\\\n' + match[2]) && undefined : 'pending'
            }
            const ordered = marker[0] === '.' || (marker[0] === '<' && (marker = '<.>') && true)
            if (inList) {
              listStack.push(inList)
              const siblingIdx = listStack.findIndex((it) => it.marker === marker)
              if (~siblingIdx) listStack.splice(siblingIdx + 1)
              if (marker === (inList = listStack[listStack.length - 1]).marker) listStack.pop()
            }
            if (!inList || inList.marker !== marker) {
              indent = (inList || inContainer).childIndent || ''
              const childIndent = indent + ' '.repeat(parseInt(attrs['markdown-list-indent'], 10) || (ordered ? 3 : 2))
              inList = { marker, indent, childIndent, numeral: ordered ? 0 : undefined }
            }
            indent = inList.indent
            verbatim = verbatim?.close()
            subs = (inPara = true) && NORMAL_SUBS
            line = (ordered ? ++inList.numeral + '. ' : '* ') + text
          } else if (inPara) {
            subs = NORMAL_SUBS
            if (verbatim && chr0 === ' ') {
              subs = verbatim.subs
              line = line.slice(verbatim.outdent)
            } else if (hardbreakAtNext) {
              accum[accum.length - 1] += '\\'
            } else if ((grab = accum[accum.length - 1]) && (grab = hardbreak(grab, '\\', undefined))) {
              accum[accum.length - 1] = grab
            }
          } else if (chr0 === '.') {
            subs = NORMAL_SUBS
            if (line.length > 1 && !(line[1] === '.' && line[2] === '.')) {
              const text = line[1] === '*' && line[line.length - 1] === '*' ? line.slice(2, -1) : line.slice(1)
              blockTitle = { indent, text, subs }
              line = undefined
            }
          } else if (chr0 === ' ') {
            indent = (inList || inContainer).childIndent || ''
            if (blockAttrs) {
              if (blockAttrs.get('subs')?.includes('attributes')) subs = ['attributes']
              blockTitle && (blockTitle.id = blockAttrs.get('id'))
            }
            verbatim = { outdent: line.length - line.trimStart().length, subs }
            verbatim.close = () => verbatim.cap ? accum.push(verbatim.cap) && undefined : undefined
            line = (inPara = true) && line.slice(verbatim.outdent)
            if (line[0] === '$' && line[1] === ' ') {
              verbatim.cap = indent + '```'
              line = '```console\n' + indent + line
            } else {
              indent += '    '
            }
          } else if (~(match = line.indexOf(': ')) && match < 10 && (style = line.slice(0, match)) in ADMONS) {
            subs = (inPara = true) && NORMAL_SUBS
            line = '*' + ADMONS[style] + ' ' + style + '*' + line.slice(style.length + 1)
          } else if (chr0 === 'i' && line.startsWith('image::') && (match = BlockImageMacroRx.exec(line))) {
            blockAttrs && blockTitle && (blockTitle.id = blockAttrs.get('id'))
            subs = ['attributes']
            line = image.apply(attrs, match)
          } else if (line in BREAKS) {
            line = BREAKS[line]
          } else {
            if (blockAttrs && (grab = blockAttrs.get('id'))) line = '[[' + grab + ']]' + line
            subs = (inPara = true) && NORMAL_SUBS
          }
        }
        if (line === undefined) return accum
        if (blockTitle) {
          const { id, indent: pd, text: titleText, subs: titleSubs } = blockTitle
          const title = applySubs.call(substitutors, titleText, titleSubs, (blockTitle = undefined))
          accum.push(pd + (id ? '<a name="' + id + '"></a>**' + (refs[id] = { title }).title : '**' + title) + '**', '')
        }
        if (line) {
          if (subs && !(line = applySubs.call(substitutors, line, subs)) && !accum.length) return accum
          if (indent && line) line = indent + line
        }
        hardbreakAtNext &&= hardbreakAtNext === 'pending' || undefined
        accum.push(line)
        return accum
      }
    }, [])
    .join('\n')
    .trimEnd()
    .replace(RewriteInternalXrefRx, (_, text, id) => {
      const { title = id, autoId = id } = refs[id] || {}
      return '[' + (text || title) + '](#' + autoId + ')'
    })
    .concat(((grab = verbatim?.cap)) ? '\n' + grab : '') // prettier-ignore
}

function applySubs (str, subs) {
  return /[{\x60\x27*_:<[#]/.test(str) ? subs.reduce((accum, name) => this[name](accum), str) : str
}

function attributes (str) {
  if (!~str.indexOf('{')) return str
  return str.replace(AttributeReferenceRx, (m, esc, name) => (esc ? m.slice(1) : name in this ? this[name] : m))
}

function callouts (str) {
  return str[str.length - 1] === '>' ? str.replace(ConumRx, (_, space, num) => space + this.get(num)) : str
}

function hardbreak (str, mark, ifAbsent = str, len = str.length) {
  return str[len - 1] === '+' && str[len - 2] === ' ' ? str.slice(0, len - 2) + mark : ifAbsent
}

function image (_, target, text) {
  return `![${text.split(',')[0] || target.split('/').pop()}](${(this.imagesdir ? this.imagesdir + '/' : '') + target})`
}

function isDlistItem (str, capture, skip = str.indexOf('::') < 0, l) {
  if (skip || (str.indexOf(':: ') < 1 && ((l = str.length) < 3 || str[l - 1] !== ':' || str[l - 2] !== ':'))) return
  return DlistItemRx[capture ? 'exec' : 'test'](str)
}

function isHeading (str, acceptAll, blockAttrs, marker, title, spaceIdx = str.indexOf(' ')) {
  if (!~spaceIdx || (marker = str.slice(0, spaceIdx)) !== '='.repeat(spaceIdx)) return
  if (!(title = str.slice(spaceIdx + 1)) || title[0] === ' ') return
  if (acceptAll || (blockAttrs && blockAttrs.get(1) === 'discrete')) return [marker, title]
}

function macros (str, hasColon) {
  if ((hasColon = ~str.indexOf(':')) && ~str.indexOf('image:')) str = str.replace(InlineImageMacroRx, image.bind(this))
  if (hasColon && (~str.indexOf(':/') || ~str.indexOf('link:'))) {
    str = str.replace(LinkMacroRx, (_, scheme = '', url, text, esc, bareUrl, bareScheme, bareUrlWithoutScheme) => {
      if (!bareUrl) return '[' + (text ||= 'hide-uri-scheme' in this ? url : scheme + url) + '](' + scheme + url + ')'
      if (esc) return '<span>' + bareScheme + '</span>' + bareUrlWithoutScheme
      return 'hide-uri-scheme' in this ? '[' + bareUrlWithoutScheme + '](' + bareUrl + ')' : bareUrl
    })
  }
  if (~str.indexOf('[[')) str = str.replace(InlineAnchorRx, '<a name="$1"></a>')
  if (!(hasColon && ~str.indexOf('xref:'))) return str
  return str.replace(XrefMacroRx, (m, esc, path, suffix = '', id, text) =>
    esc ? m.slice(1) : '[' + text + '](' + (path ? path + suffix : '#!' + id) + ')'
  )
}

function parseAttrlist (attrlist, attrs = new Map()) {
  if (!attrlist) return attrs
  attrs.set(0, attrlist)
  let chr0, idx, m, shorthand, style
  if ((chr0 = attrlist[0]) === '[' && (m = BlockAnchorRx.exec(attrlist))) {
    return m[2] ? attrs.set('id', m[1]).set('reftext', m[2]) : attrs.set('id', m[1])
  }
  if (!(idx = 0) && (~attrlist.indexOf('=') || ~attrlist.indexOf('"'))) {
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
    if ((chr0 = m[1]) === '#') attrs.set('id', m[2])
    else if (chr0 === undefined) style = m[2]
    else if (chr0 === '.') attrs.set('role', m[2])
    else attrs.set(m[2] + '-option', '')
  }
  return attrs.set(1, style)
}

function quotes (str) {
  const hasLt = ~(~str.indexOf('<<') ? (str = str.replace(XrefShorthandRx, 'xref:$1[$2]')) : str).indexOf('<')
  if (hasLt) str = str.replace(/</g, '&lt;')
  if (~str.indexOf('*')) str = str.replace(/(?:\[[^[\]]+\]|)(?<!\\)\*(\S|\S.*?\S)\*/g, '**$1**')
  if (~str.indexOf('"`')) str = str.replace(/"`(\S|\S.*?\S)`"/g, '<q>$1</q>')
  if (~str.indexOf('`') && (hasLt || ~str.indexOf('`+') || ~str.indexOf('\\'))) {
    str = str.replace(/`(\+)?(\S|\S.*?\S)\1`/g, (_, pass, text) => {
      if (hasLt && text.length > 3 && ~text.indexOf('&lt;')) text = text.replace(/&lt;/g, '<')
      if (pass) return '`' + (~text.indexOf('{') ? text.replace(/\{(?=[a-z])/g, '\\{') : text) + '`'
      return '`' + (~text.indexOf('\\') ? text.replace(/\\(?!\s|\\?{)/g, '') : text) + '`'
    })
  }
  if (~str.indexOf('_')) str = str.replace(/(?:\[[^[\]]+\]|)\b(?<!\\)_(\S|\S.*?\S)_(?=\b)/g, '_$1_')
  ~str.indexOf('#') &&
    (str = str.replace(/(?<![\p{Alpha}0-9&\\\]])(\[[^[\]]+\])?#(\S|\S.*?\S)#(?![\p{Alpha}0-9])/gu, (_, roles, text) =>
      roles ? (roles === '[.line-through]' ? '~~' + text + '~~' : text) : '<mark>' + text + '</mark>'
    ))
  return ~str.indexOf("'") ? str.replace(/\x60'(?!\x60)|(?<=[\p{Alpha}0-9])'(?=\p{Alpha})/gu, '\u2019') : str
}
