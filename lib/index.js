'use strict'

const ADMONS = JSON.parse(
  '{"CAUTION":"\ud83d\udd25","IMPORTANT":"\u2757","NOTE":"\ud83d\udccc","TIP":"\ud83d\udca1","WARNING":"\u26a0\ufe0f"}'
)
const ATTRIBUTES = JSON.parse(
  '{"empty":"","idprefix":"_","idseparator":"_","markdown-line-break":"\\\\","markdown-strikethrough":"~~",' +
    '"nbsp":"&#160;","quotes":"<q> </q>","sp":" ","vbar":"|","zwsp":"&#8203;"}'
)
const BREAKS = { "'''": '---', '***': '---', '---': '---', '<<<': undefined, 'toc::[]': undefined }
const CONUMS = [...Array(19)].reduce((m, _, i) => (m[i + 1] = String.fromCharCode(0x2460 + i)) && m, {})
const DELIMS = { '----': 'v', '....': 'v', '====': 'c', '|===': 't', '--': 'c', '****': 'c', ____: 'c', '++++': 'p' }
const LIST_MARKERS = { '*': true, '.': true, '<': true, '-': true }
const NORMAL_SUBS = ['quotes', 'attributes', 'macros']
const SUBSTITUTORS = { quotes, attributes, macros, callouts }
const TDIV = { '': '| --- ', '<': '| :-- ', '^': '| :-: ', '>': '| --: ' }

const AttributeEntryRx = /^:([^:]+):(?:$| (.+))/
const AttributeRefRx = /(\\)?\{([\p{Ll}\d_][\p{Ll}\d_-]*)\}/gu
const AuthorInfoLineRx = /^(?:[\p{Alpha}\d_]+(?: +[\p{Alpha}\d_]+){0,2}(?: +<([^>]+)>)?(?:; |$))+$/u
const BlockAnchorRx = /^\[([\p{L}_][\p{Alpha}\d_\-:.]*)(?:, ?(.+))?\]$/u
const BlockImageMacroRx = /^image::([^\s[][^[]*)\[(.*)\]$/
const CellDelimiterRx = /(?:^| *)[a-z]?\| */
const ConumRx = /(^| )<([.1-9]|1\d)>(?=(?: <(?:[.1-9]|1\d)>)*$)/g
const DlistItemRx = /^(?!\/\/)(\S.*?)::(?: (.+))?($)/
const ElementAttributeRx = /(?:^|, *)(?:(\w[\w-]*)=)?(?:("|')([^\2]+?)\2|([^,]+|))/g
const EmphasisSpanMetaRx = /(?<![\p{L}\d_\\])\[[^[\]]+\](?=_(?:\S|\S.*?\S)_(?![\p{L}\d_]))/gu
const InlineAnchorRx = /\[\[([\p{L}_][\p{Alpha}\d_\-:.]*)\]\]/u
const InlineImageMacroRx = /image:(?![\s:`])([^[\\]+)\[(|.*?[^\\])\]/g
const InlineStemMacroRx = /stem:\[(.*?[^\\])\]/g
const LinkMacroRx = /(\\)?(?:(?:link:(?!:)|(https?:\/\/))([^\s[\\]+)(\[(|.*?[^\\])\^?\])|(https?:\/\/)([^\s[\]]+))/g
const ListItemRx = /^(\*+|\.+|<[1-9.]>|-(?! -)) (.+)/
const MarkedSpanRx = /(?<![\p{L}\d_\\])(?:\[((\.line-through)|[^[\]]+)\])?#(\S|\S.*?\S)#(?![\p{L}\d_])/gu
const PreprocessorDirectiveRx = /^\\?(?:(if)(n)?def|include)::([^[]+)\[(.+)?\]$/
const QuotedSpanRx = /("|')`(\S|\S.*?\S)`\1/g
const RevisionInfoLineRx = /^v(\d+(?:[-.]\w+)*)(?:, (\d+-\d+-\d+))?|(\d+-\d+-\d+)$/
const RewriteInternalXrefRx = /\[([^[]*?)\]\(#!([^)]+)\)/g
const StrongSpanRx = /(?<![\p{L}\d_\\])(?:\[[^[\]]+\])?(\*(?:\S|\S.*?\S)\*)(?![\p{L}\d_])/gu
const StyleShorthandMarkersRx = /([.#%])/
const XrefMacroRx = /(\\)?xref:(?![\s:`])(?:([^#[\\]+)(#[^\s[\\]*|\.adoc)|#([^\s[\\]+)|([^#[\\]+))\[(|.*?[^\\])\]/g
const XrefShorthandRx = /<<([^\s,>][^,>]*)(?:, ?([^>]+))?>>/g

module.exports = function downdoc (asciidoc, { attributes: initialAttrs = {} } = {}) {
  const attrs = new Map(Object.entries(Object.assign({}, ATTRIBUTES, initialAttrs)))
  const lines = asciidoc.split(attrs.delete('doctitle') ? '\n' : '\n')
  if (lines[lines.length - 1] === '') lines.pop()
  let inContainer, inHeader, inList, inPara, inTable
  inHeader = (inContainer = inPara = false) || asciidoc[0] === '=' || !!~asciidoc.indexOf('\n= ')
  const refs = new Map()
  const nrefs = new Map()
  let blockAttrs, blockTitle, chr0, grab, hardbreakNext, indent, listStack, match, next, skipping, subs, style, verbatim
  const containerStack = (indent = '') || (listStack = []).slice()
  const undef = () => undefined
  return lines
    .reduce((accum, line, idx) => {
      while ((grab = match = next = style = subs = undefined) === undefined) {
        if (skipping || (skipping === false && line === 'endif::[]' && (skipping = line))) {
          line = line === skipping ? (skipping = undefined) : undefined
        } else if (!line && !inContainer.verbatim) {
          inHeader = inPara = false
          inList ? (inPara = undefined) : (line = indent = inContainer.childIndent || '') && (line = line.trimEnd())
          blockAttrs = blockTitle = verbatim = verbatim?.close()
          return inTable || !accum[accum.length - 1] ? accum : accum.push(line) && accum
        } else if (((grab = (chr0 = line[0]) === '\\') || (chr0 === 'i' && line[1] !== 'm')) &&
            ((grab && line === '\\endif::[]') || (line[line.length - 1] === ']' && ~line.indexOf('::') &&
            (match = PreprocessorDirectiveRx.exec(line)))) && (grab ? !(line = line.slice(1)) : true)) {
          if (match[1]) {
            const [,, negated, name, text] = match
            skipping = (attrs.has(name) ? negated : !negated) ? 'endif::[]' : false
            if (text && (skipping ? (skipping = undefined) : (line = (skipping = undefined) || text))) continue // redo
          }
          line = undefined
        } else if (inContainer.verbatim) {
          const outdent = inContainer.outdent
          if (line === inContainer.delimiter) {
            ;({ cap: line, indent, inList, listStack } = inContainer)
            const left = outdent && (outdent + indent.length)
            if (left) for (let i = inContainer.at, l = accum.length; ++i < l;) accum[i] = indent + accum[i].slice(left)
            inContainer = containerStack.length ? containerStack.pop() : false
          } else if ((grab = line.length) > 2) {
            if (outdent) inContainer.outdent = Math.min(grab - line.trimStart().length, outdent)
            if (~line.indexOf('{') || line[grab - 1] === '>') subs = inContainer.subs
          } else if (outdent && grab) inContainer.outdent = Math.min(grab - line.trimStart().length, outdent)
        } else if (!inHeader && line in DELIMS) {
          if (inPara !== false) inPara = !listStack.splice(inList = undef((indent = inContainer.childIndent || '')))
          const opening = inContainer === false || (line !== inContainer.delimiter && containerStack.push(inContainer))
            ? (inContainer = { delimiter: line, indent, childIndent: indent, inList, listStack })
            : undefined
          if ((grab = DELIMS[line]) === 'v') {
            inContainer.subs = (inContainer.verbatim = !!(attrs.coseq = 1)) && ['callouts']
            if (blockAttrs) {
              style = ((style = blockAttrs.get(1) || (line === '----' ? 'source' : undefined)) === 'source')
                ? blockAttrs.get(2) || attrs.get('source-language')
                : style === 'listing' || style === 'literal' ? undefined : style
              if (blockAttrs.get('indent') === '0') Object.assign(inContainer, { at: accum.length, outdent: Infinity })
              if (blockAttrs.get('subs')?.includes('attributes')) inContainer.subs = ['callouts', 'attributes']
              blockTitle &&= writeBlockTitle(accum, blockTitle, blockAttrs, attrs, refs)
            } else if (line === '----') style = attrs.get('source-language')
            line = style ? (inContainer.cap = '```') + style : (inContainer.cap = '```')
          } else if (grab === 'p' && (inContainer.verbatim = true)) {
            line = blockAttrs && blockAttrs.get(1) === 'stem' ? (inContainer.cap = '```') + 'math' : undefined
            blockTitle = undefined
          } else if (opening === undefined) {
            ;({ cap: line, indent, inList, listStack } = inContainer)
            inTable = blockTitle = undefined
            inContainer = containerStack.length ? containerStack.pop() : false
          } else if (grab === 't' && (inTable = { header: blockAttrs?.has('header-option') || undefined })) {
            if (blockAttrs && (grab = blockAttrs.get('cols'))) {
              const cols = (!~grab.indexOf('*') && grab.split(/,|;/)) || grab.split(/,|;/)
                .reduce((a, c) => a.push.apply(a, ~c.indexOf('*') ? Array(parseInt(c, 10)).fill(c) : [c]) && a, [])
              ;(inTable.div = ~grab.indexOf('<') || ~grab.indexOf('^') || ~grab.indexOf('>')
                ? cols.reduce((buf, c) => buf + TDIV[/(?<!\.)[<^>]|$/.exec(c)[0]], '') + '|'
                : TDIV[''].repeat(cols.length) + '|') && (inTable.cols = cols.length)
            }
            line = undefined
          } else if (line === '____') {
            indent = inContainer.childIndent += '> '
            if ((grab = blockAttrs && blockAttrs.get(2))) inContainer.cap = '>\n' + indent + '\u2014 ' + grab
            line = blockTitle &&= writeBlockTitle(accum, blockTitle, blockAttrs, attrs, refs)
          } else if (line === '====' && blockAttrs) {
            if ((style = blockAttrs.get(1)) in ADMONS) {
              line = '<dl><dt><strong>' + (blockAttrs.has('id') ? '<a name="' + blockAttrs.get('id') + '"></a>' : '') +
                ADMONS[style] + ' ' + style + (blockTitle ? ': ' + blockTitle.text : '') + '</strong></dt><dd>\n'
              inContainer.cap = '</dd></dl>'
              blockTitle = undefined
            } else if (blockAttrs.has('collapsible-option')) {
              line = attrs.get('markdown-collapsible-variant') === 'spoiler' && (grab = 'spoiler')
                ? (inContainer.cap = '```') + (blockTitle ? grab + ' ' + applySubs.call(attrs, blockTitle.text) : grab)
                : (inContainer.cap = '</details>') && (blockAttrs.has('open-option') ? '<details open>' : '<details>') +
                  '\n' + indent + '<summary>' + (blockTitle ? blockTitle.text : 'Details') + '</summary>\n'
              blockTitle = undefined
            } else line = blockTitle &&= writeBlockTitle(accum, blockTitle, blockAttrs, attrs, refs)
          } else line = blockTitle &&= writeBlockTitle(accum, blockTitle, blockAttrs, attrs, refs)
          if (opening !== (blockAttrs = undefined)) listStack = (inList = undefined) || []
        } else {
          let _chr0, _line, indented
          if (!(indented = chr0 === ' ')) _line = line
          if (inPara === undefined && !(inPara = false) && (_chr0 = indented ? (_line = line.trimStart())[0] : chr0)) {
            ;(_chr0 in LIST_MARKERS && ListItemRx.test(_line)) || isDlistItem(_line)
              ? accum.pop()
              : !indented && listStack.splice(inList = undef((indent = inContainer.childIndent || '')))
          }
          if (chr0 === '/' && line[1] === '/') {
            line = line === '////' ? undef((inPara = !(skipping = '////'))) : undefined
          } else if (!inPara && chr0 === '=' && (match = isHeading(line, inContainer === false, blockAttrs))) {
            let [marker, title, id, autoId] = match
            if (inHeader) {
              if (marker.length > 1 || (blockAttrs && blockAttrs.get(1) === 'discrete') || attrs.has('doctitle')) {
                if (!(inHeader = false) && accum.length) return accum
                continue // redo
              }
              attrs.set('doctitle', title)
              if ((id = blockAttrs?.get('id'))) autoId = title.toLowerCase().split(' ').join('-')
            } else {
              autoId = (grab = (title = attributes.call(attrs, title)).toLowerCase().split(' ')).join('-')
              id = blockAttrs?.get('id') || attrs.get('idprefix') + grab.join(attrs.get('idseparator'))
            }
            if (id) refs.set(title, refs.set(id, { autoId, reftext: blockAttrs?.get('reftext'), title }).get(id))
            blockAttrs = blockTitle = undefined
            line = '#'.repeat(marker.length) + ' ' + title
          } else if (!inPara && chr0 === ':' && (match = AttributeEntryRx.exec(line))) {
            const [, name, value = ''] = (line = undefined) || match
            if (!(name in initialAttrs)) attrs.set(name, value && attributes.call(attrs, value))
          } else if (chr0 === '[' && line[line.length - 1] === ']') {
            if (verbatim && !(inPara = verbatim = verbatim.close())) continue
            blockAttrs = parseAttrlist(line.slice(1, -1), blockAttrs)
            line = (inPara = false) || undefined
          } else if (inHeader) {
            if ((inHeader = attrs.has('doctitle'))) {
              if (!attrs.has('author') && AuthorInfoLineRx.test(line)) {
                const authors = line.split('; ').map((it) => it.split(' <')[0])
                attrs.set('author', authors[0]).set('authors', authors.join(', '))
              } else if (!('revdate' in attrs) && !('revnumber' in attrs) && (match = RevisionInfoLineRx.exec(line))) {
                const [, revnumber, revdate_, revdate = revdate_] = match
                if (revnumber) attrs.set('revnumber', revnumber)
                if (revdate) attrs.set('revdate', revdate)
              } else inHeader = false
            }
            if (!inHeader && !accum.length) continue // redo
            line = undefined
          } else if (inTable) {
            const row = inTable.currentRow
            const cells = ~line.indexOf('|', 1)
              ? line.split(CellDelimiterRx)
              : line[0] === '|' ? ['', line.slice(line[1] === ' ' ? 2 : 1)] : [line]
            if (row) {
              if (cells[0]) {
                if (row.length && (inTable.hasWrappedRow = true)) {
                  row[row.length - 1] = ((grab = row[row.length - 1]) && hardbreak(grab, ' +\n') + ' ') + cells[0]
                } else {
                  line = hardbreak((grab = accum[accum.length - 1].split('\n'))[0].slice(0, -2).trimEnd(), '<br>') +
                    ' ' + applySubs.call(attrs, cells[0]) + ' |'
                  accum[accum.length - 1] = grab.length > 1 ? (grab[0] = line) && grab.join('\n') : line
                }
              }
              if ((cells.length === 1 ? row.length : row.push.apply(row, cells.slice(1))) < inTable.cols) return accum
              line = applySubs.call(attrs, '| ' + row.splice(0, inTable.cols).join(' | ') + ' |')
              if (inTable.hasWrappedRow && ~line.indexOf(' +\n')) line = line.replace(/ \+\n/g, '<br>')
            } else {
              const cols = (inTable.currentRow = []) && (inTable.cols ??= cells.length - 1)
              if (!(inTable.header ??= cols === cells.length - 1 && lines[idx + 1] === '')) {
                blockTitle &&= writeBlockTitle(accum, blockTitle, blockAttrs, attrs, refs)
                accum.push(indent + '|     '.repeat(cols) + '|', indent + (inTable.div || TDIV[''].repeat(cols) + '|'))
                continue // redo
              }
              subs = NORMAL_SUBS
              line = '| ' + cells.slice(1).join(' | ') + ' |\n' + indent + (inTable.div || TDIV[''].repeat(cols) + '|')
            }
          } else if (line === '+' && inList) {
            ;({ indent: line, childIndent: indent } = inList)
            verbatim = (inPara = false) || verbatim?.close()
            return accum.push(line && line.trimEnd()) && accum
          } else if ((!inPara || inList) && (_chr0 ??= indented ? (_line = line.trimStart())[0] : chr0) &&
              (_chr0 in LIST_MARKERS ? (match = ListItemRx.exec(_line)) : (match = isDlistItem(_line, true)))) {
            let [, marker, text, dlist] = match
            if (dlist !== undefined) {
              (blockAttrs && blockAttrs.get(1) === 'qanda') || (inList && inList.dlist === 'qanda')
                ? (text = '_' + marker + '_') && (marker = '.') && (dlist = 'qanda')
                : (text = '*' + marker + '*') && (marker = '-')
              if (!(next = match[2])) hardbreakNext = 'pending'
            }
            const ordered = marker[0] === '.' || (marker[0] === '<' && !!(marker = '<.>'))
            if (inList && listStack.push(inList)) {
              if (~(match = listStack.findIndex((it) => it.marker === marker))) listStack.splice(match + 1)
              if (marker === (inList = listStack[listStack.length - 1]).marker) listStack.pop()
            }
            if (!inList || inList.marker !== marker) {
              indent = (inList || inContainer).childIndent || ''
              const lindent = (attrs.lindent ??= parseInt(attrs.get('markdown-list-indent'), 10)) || (ordered ? 3 : 2)
              inList = { marker, indent, childIndent: indent + ' '.repeat(lindent), numeral: ordered && 0, dlist }
            } else indent = inList.indent
            verbatim = verbatim?.close()
            subs = (inPara = true) && NORMAL_SUBS
            line = (ordered ? ++inList.numeral + '. ' : '* ') + text
          } else if (inPara) {
            if (verbatim && indented) {
              subs = verbatim.subs
              line = line.slice(verbatim.outdent)
            } else if ((subs = NORMAL_SUBS) && hardbreakNext) {
              accum[accum.length - 1] += attrs.get('markdown-line-break')
            } else if ((grab = accum[accum.length - 1] ?? '')[grab.length - 1] === '+') {
              accum[accum.length - 1] = hardbreak(grab, attrs.get('markdown-line-break'))
            }
          } else if (chr0 === '.') {
            subs = NORMAL_SUBS
            if (line.length > 1 && !(line[1] === '.' && line[2] === '.')) {
              const text = line[1] === '*' && line[line.length - 1] === '*' ? line.slice(2, -1) : line.slice(1)
              blockTitle = (line = undefined) || { indent, text, subs }
            }
          } else if (indented) {
            if (blockAttrs && blockAttrs.get('subs')?.includes('attributes')) subs = ['attributes']
            const outdent = line.length - (line = _line).length
            if ((inPara = true) && _chr0 === '$' && _line[1] === ' ') {
              indent = (inList || inContainer).childIndent || ''
              verbatim = { cap: indent + '```', close: () => accum.push(verbatim.cap) && undefined, outdent, subs }
              line = '```console\n' + indent + line
            } else {
              indent = ((inList || inContainer).childIndent || '') + '    '
              verbatim = { close: undef, outdent, subs }
            }
          } else if (~(match = line.indexOf(': ')) && match < 10 && (style = line.slice(0, match)) in ADMONS) {
            next = (inPara = true) && line.slice(match + 2)
            line = '**' + ADMONS[style] + ' ' + style + '**'
          } else if (chr0 === 'i' && line.startsWith('image::') && (match = BlockImageMacroRx.exec(line))) {
            subs = ['attributes']
            line = image.apply(attrs, match)
          } else if (line in BREAKS) {
            line = BREAKS[line]
          } else {
            if ((grab = blockAttrs?.get('id'))) blockTitle ? (blockTitle.id = grab) : (line = '[[' + grab + ']]' + line)
            subs = (inPara = true) && NORMAL_SUBS
          }
        }
        if (line) {
          blockTitle &&= writeBlockTitle(accum, blockTitle, blockAttrs, attrs, refs)
          if (subs && !(line = applySubs.call(attrs, line, subs)) && !accum.length) return accum
          accum.push(indent && line ? indent + line : line)
          ;(next &&= applySubs.call(attrs, next)) && (accum[accum.length - 1] += attrs.get('markdown-line-break')) &&
            accum.push(indent ? indent + next : next)
        } else if (line === undefined) {
          return accum
        } else accum.push(line)
        hardbreakNext &&= hardbreakNext === 'pending' || undefined
        return accum
      }
    }, [])
    .join('\n')
    .trimEnd()
    .replace(RewriteInternalXrefRx, (_, text, id) => {
      const { title = id, reftext = title, autoId = id } = refs.get(id) || nrefs.get(id) || {}
      return '[' + (text || reftext) + '](#' + autoId + ')'
    })
    .concat(((grab = verbatim?.cap)) ? '\n' + grab : '') // prettier-ignore
}

function applySubs (str, subs = NORMAL_SUBS) {
  return /[{\x60\x27*_:<[#]/.test(str) ? subs.reduce((str, name) => SUBSTITUTORS[name].call(this, str), str) : str
}

function attributes (str) {
  return ~str.indexOf('{') ? str.replace(AttributeRefRx, (m, bs, name) => (bs ? m.slice(1) : this.get(name) ?? m)) : str
}

function callouts (str, apply = str[str.length - 1] === '>') {
  return apply ? str.replace(ConumRx, (_, sp, chr) => sp + CONUMS[chr === '.' ? this.coseq++ : chr]) : str
}

function hardbreak (str, mark, len = str.length) {
  return str[len - 1] === '+' && str[len - 2] === ' ' ? str.slice(0, -2) + mark : str
}

function image (_, target, attrlist, _idx, _str, alt = attrlist.split(',')[0] || /(.*\/)?(.*?)($|\.)/.exec(target)[2]) {
  return '![' + alt + '](' + (this.get('imagesdir') ? this.get('imagesdir') + '/' : '') + target + ')'
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

function macros (str) {
  if (!~str.indexOf(':')) return ~str.indexOf('[[') ? str.replace(InlineAnchorRx, '<a name="$1"></a>') : str
  if (~str.indexOf('m:[')) str = str.replace(InlineStemMacroRx, (_, expr) => '$' + expr.replace(/\\]/g, ']') + '$')
  if (~str.indexOf('image:')) str = str.replace(InlineImageMacroRx, image.bind(this))
  if (~str.indexOf(':/') || ~str.indexOf('link:')) {
    str = str.replace(LinkMacroRx, (_, esc, scheme = '', url, boxed = '', text, bareScheme = scheme, bareUrl) => {
      if (esc) return bareScheme ? '<span>' + bareScheme + '</span>' + (bareUrl ?? url + boxed) : 'link:' + url + boxed
      if (!bareUrl) return '[' + (text ||= this.has('hide-uri-scheme') ? url : scheme + url) + '](' + scheme + url + ')'
      return this.has('hide-uri-scheme') ? '[' + bareUrl + '](' + bareScheme + bareUrl + ')' : bareScheme + bareUrl
    })
  }
  if (~str.indexOf('[[')) str = str.replace(InlineAnchorRx, '<a name="$1"></a>')
  if (!~str.indexOf('xref:')) return str
  return str.replace(XrefMacroRx, (m, esc, path, suffix, id_, id = id_, text) =>
    esc ? m.slice(1) : '[' + text + '](' + (path ? path + (suffix === '#' ? '' : suffix) : '#!' + id) + ')'
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
  } else attrs.set(1, attrlist)
  if (!(shorthand = attrs.get(1)) || (m = shorthand.split(StyleShorthandMarkersRx)).length < 2) return attrs
  for (let i = 0, len = m.length, val; i < len; i += 2) {
    if ((val = m[i]) && ((chr0 = m[i - 1]) || !(style = val))) {
      chr0 === '#' ? attrs.set('id', val) : chr0 === '.' ? attrs.set('role', val) : attrs.set(val + '-option', '')
    }
  }
  return attrs.set(1, style)
}

function quotes (str, idx) {
  const hasLt = ~(~str.indexOf('<<') ? (str = str.replace(XrefShorthandRx, 'xref:$1[$2]')) : str).indexOf('<')
  if (hasLt) str = str.replace(/</g, '&lt;')
  if (~(idx = str.indexOf('*')) && ~str.indexOf('*', idx + 1)) str = str.replace(StrongSpanRx, '*$1*')
  if (~str.indexOf('`') && ((idx = ~str.indexOf('"`') || ~str.indexOf("'`")) || true)) {
    if (idx) str = str.replace(QuotedSpanRx, (this.q ??= this.get('quotes').split(' ').slice(0, 2).join('$2')))
    if (hasLt || ~str.indexOf('`+') || ~str.indexOf(']`') || ~str.indexOf('\\')) {
      str = str.replace(/(?:\[[^[\]]+\])?`(\+)?(\S|\S.*?\S)\1`/g, (_, pass, text) => {
        if (hasLt && text.length > 3 && ~text.indexOf('&lt;')) text = text.replace(/&lt;/g, '<')
        if (pass) return '`' + (~text.indexOf('{') ? text.replace(/\{(?=[a-z])/g, '\\{') : text) + '`'
        return '`' + (~text.indexOf('\\') ? text.replace(/\\(?=https?:|\.\.\.)/g, '') : text) + '`'
      })
    }
  }
  if (~str.indexOf(']_')) str = str.replace(EmphasisSpanMetaRx, '')
  if (~(idx = str.indexOf('#')) && ~str.indexOf('#', idx + 1)) {
    str = str.replace(MarkedSpanRx, (_, roles, s, text) => {
      s &&= this.s ??= (s = this.get('markdown-strikethrough').split(' ')).length > 1 ? s.slice(0, 2) : [s[0], s[0]]
      return roles ? (s ? s[0] + text + s[1] : text) : '<mark>' + text + '</mark>'
    })
  }
  return ~str.indexOf("'") ? str.replace(/\x60'(?!\x60)|(?<=[\p{L}\d])'(?=\p{L})/gu, '\u2019') : str
}

function writeBlockTitle (buffer, blockTitle, blockAttrs, attrs, refs) {
  const { id = blockAttrs?.get('id'), indent, text, subs, title = applySubs.call(attrs, text, subs) } = blockTitle
  const anchor = id && refs.set(id, { title, reftext: blockAttrs.get('reftext') }) ? '<a name="' + id + '"></a>' : ''
  buffer.push(indent + anchor + '**' + title + '**', '')
}
