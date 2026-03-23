'use strict'

const { assert, assertx, describe, heredoc, it } = require('./harness')
const downdoc = require('downdoc')

describe('downdoc()', () => {
  describe('document parts', () => {
    it('should convert empty document', () => {
      const input = ''
      assert.equal(downdoc(input), input)
    })

    it('should convert document with only body', () => {
      const input = 'Body.'
      assert.equal(downdoc(input), input)
    })

    it('should convert document with only document title', () => {
      const input = '= Title'
      const expected = '# Title'
      assert.equal(downdoc(input), expected)
    })

    it('should convert document with header and body', () => {
      const input = heredoc`
      = Title

      Body.
      `
      const expected = heredoc`
      # Title

      Body.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert document with body directly adjacent to header', () => {
      const input = heredoc`
      = Title
      > Ignored

      Body.
      `
      const expected = heredoc`
      # Title

      Body.
      `
      assert.equal(downdoc(input), expected)
    })
  })

  describe('document header', () => {
    it('should store document title in doctitle attribute', () => {
      const input = heredoc`
      = Document Title

      The title of this document is {doctitle}.
      `
      const expected = heredoc`
      # Document Title

      The title of this document is Document Title.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should consume author line with single author', () => {
      const input = heredoc`
      = Title
      Doc Writer <doc@example.org>

      Body written by {author}.
      `
      const expected = heredoc`
      # Title

      Body written by Doc Writer.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should consume author line with multiple authors', () => {
      const input = heredoc`
      = Title
      Doc Writer <doc@example.org>; Junior Écrivain <jr@example.org>

      This document was written by {authors}.
      It was lead by {author}.
      `
      const expected = heredoc`
      # Title

      This document was written by Doc Writer, Junior Écrivain.
      It was lead by Doc Writer.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should consume revision line with only version', () => {
      const input = heredoc`
      = Title
      Author Name
      v1.0.0

      {revnumber}
      `
      const expected = heredoc`
      # Title

      1.0.0
      `
      assert.equal(downdoc(input), expected)
    })

    it('should consume revision line with only date', () => {
      const input = heredoc`
      = Title
      Author Name
      2022-10-22

      {revdate}
      `
      const expected = heredoc`
      # Title

      2022-10-22
      `
      assert.equal(downdoc(input), expected)
    })

    it('should consume revision line with version and date', () => {
      const input = heredoc`
      = Title
      Author Name
      v2, 2022-10-22

      Version {revnumber} released on {revdate}.
      `
      const expected = heredoc`
      # Title

      Version 2 released on 2022-10-22.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should consume line after author line if only contains single number', () => {
      const input = heredoc`
      = Title
      Author Name
      22

      {revnumber}
      `
      const expected = heredoc`
      # Title

      {revnumber}
      `
      assert.equal(downdoc(input), expected)
    })

    it('should process and remove attribute entries found in document header below doctitle', () => {
      const input = heredoc`
      = Title
      :foo: bar
      :yin: yang

      Body
      `
      const expected = heredoc`
      # Title

      Body
      `
      assert.equal(downdoc(input), expected)
    })

    it('should consume attribute entries found in document header above doctitle', () => {
      const input = heredoc`
      :foo: bar
      :yin: yang
      = Title

      Body
      `
      const expected = heredoc`
      # Title

      Body
      `
      assert.equal(downdoc(input), expected)
    })

    it('should consume attribute entries found in body', () => {
      const input = heredoc`
      = Title
      :foo: bar

      initial: {foo}

      :foo: baz

      after: {foo}
      `
      const expected = heredoc`
      # Title

      initial: bar

      after: baz
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not recognize attribute entry if attribute name begins with -', () => {
      const input = heredoc`
      :-foo: bar

      {-foo} is not a valid attribute reference.
      `
      const expected = heredoc`
      :-foo: bar

      {-foo} is not a valid attribute reference.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should substitute attribute reference in value of attribute entry', () => {
      const input = heredoc`
      :project-slug: acme
      = Title
      :url-org: https://example.org
      :url-project: {url-org}/{project-slug}

      The URL for this project is {url-project}.
      `
      const expected = heredoc`
      # Title

      The URL for this project is https://example.org/acme.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should permit underscore as attribute name', () => {
      const input = heredoc`
      = Title
      :_: {sp}

      one{_}two{_}three
      `
      const expected = heredoc`
      # Title

      one two three
      `
      assert.equal(downdoc(input), expected)
    })

    it('should set value of attribute entry to empty string if value is not specified', () => {
      const input = heredoc`
      = Title
      :empty-string:

      foo{empty-string}bar
      `
      const expected = heredoc`
      # Title

      foobar
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not set document attribute if name in attribute entry is negated', () => {
      const input = heredoc`
      = Title
      :!foo:

      ifndef::foo[]
      foo was not set
      endif::[]
      `
      const expected = heredoc`
      # Title

      foo was not set
      `
      assert.equal(downdoc(input), expected)
    })

    it('should unset document attribute if name in attribute entry is negated', () => {
      const input = heredoc`
      = Title
      :foo: bar
      :!foo:

      ifndef::foo[]
      foo has been unset
      endif::[]
      `
      const expected = heredoc`
      # Title

      foo has been unset
      `
      assert.equal(downdoc(input), expected)
    })

    it('should allow seed attributes to be passed in to API function', () => {
      const input = heredoc`
      = Title
      :attribute-from-document: from document
      :attribute-from-api: from document

      {attribute-from-api}

      {attribute-from-document}
      `
      const expected = heredoc`
      # Title

      from API

      from document
      `
      assert.equal(downdoc(input, { attributes: { 'attribute-from-api': 'from API' } }), expected)
    })

    it('should ignore doctitle attribute set from CLI', () => {
      const input = heredoc`
      = Document Title

      The doctitle is {doctitle}.
      `
      const expected = heredoc`
      # Document Title

      The doctitle is Document Title.
      `
      assert.equal(downdoc(input, { attributes: { doctitle: 'Title' } }), expected)
    })
  })

  describe('attribute references', () => {
    it('should substitute attribute reference in paragraph', () => {
      const input = heredoc`
      = Title
      :project-name: ACME

      The name of this project is {project-name}.
      `
      const expected = heredoc`
      # Title

      The name of this project is ACME.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should permit all unicode letter characters in attribute name when assigned and referenced', () => {
      const input = heredoc`
      = Le Titre
      :dépôt-git: opendevise/downdoc

      Vous pouvez aussi récupérer les sources via le dépôt Git à {dépôt-git}.
      `
      const expected = heredoc`
      # Le Titre

      Vous pouvez aussi récupérer les sources via le dépôt Git à opendevise/downdoc.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not recognize attribute reference that begins with -', () => {
      const input = heredoc`
      = Title

      {-foo} is not a valid attribute reference.
      `
      const expected = heredoc`
      # Title

      {-foo} is not a valid attribute reference.
      `
      assert.equal(downdoc(input, { attributes: { '-foo': 'bar' } }), expected)
    })

    // NOTE this test also asserts that attribute name can begin with number
    it('should substitute multiple attribute references in same line', () => {
      const input = heredoc`
      = Title
      :1st-author: Jim
      :2nd-author: Jane

      This project was created by {1st-author} and {2nd-author}.
      `
      const expected = heredoc`
      # Title

      This project was created by Jim and Jane.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should substitute attribute reference in section title', () => {
      const input = heredoc`
      = Title
      :product: ACME

      == Introduction to {product}

      Let's get acquainted.
      `
      const expected = heredoc`
      # Title

      ## Introduction to ACME

      Let’s get acquainted.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should substitute attribute reference in unordered list item', () => {
      const input = heredoc`
      = Title
      :product: ACME
      :url-product: https://example.org/acme

      . First, download the {product} installer from the {url-product}[{product} website].
      `
      const expected = heredoc`
      # Title

      1. First, download the ACME installer from the [ACME website](https://example.org/acme).
      `
      assert.equal(downdoc(input), expected)
    })

    it('should skip unresolved attribute reference', () => {
      const input = heredoc`
      = Title

      This project is named {unknown}.
      `
      const expected = heredoc`
      # Title

      This project is named {unknown}.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should unescape escaped attribute references in monospace phrase', () => {
      const input = heredoc`
      = Title

      Use \`\\{nbsp}\` to insert a no-break space (\`{nbsp}\`).
      Use \`\\\\{nbsp}\` to display an escaped attribute reference.

      Use the endpoint \`/repos/\\{owner}/\\{repo}\` to retrieve information about a repository.
      `
      const expected = heredoc`
      # Title

      Use \`{nbsp}\` to insert a no-break space (\`&#160;\`).
      Use \`\\{nbsp}\` to display an escaped attribute reference.

      Use the endpoint \`/repos/{owner}/{repo}\` to retrieve information about a repository.
      `
      assertx.include(input, '\\')
      assert.equal(downdoc(input), expected)
    })

    it('should unescape escaped attribute references in normal phrase', () => {
      const input = heredoc`
      Replace the token \\{owner} with the username or organization and replace the token \\{repo} with the name of the repository.
      `
      const expected = heredoc`
      Replace the token {owner} with the username or organization and replace the token {repo} with the name of the repository.
      `
      assertx.include(input, '\\')
      assert.equal(downdoc(input), expected)
    })

    it('should resolve all intrinsic attributes', () => {
      const input = heredoc`
      Valid responses: y {vbar} yes {vbar} n {vbar} no

      Part{nbsp}number—{zwsp}(PN)

      Add it to the _{empty}_layouts_ folder.

      Insert a \`{sp}\` character.
      `
      const expected = heredoc`
      Valid responses: y | yes | n | no

      Part&#160;number—&#8203;(PN)

      Add it to the __layouts_ folder.

      Insert a \` \` character.
      `
      assert.equal(downdoc(input), expected)
    })
  })

  describe('section titles', () => {
    it('should convert section titles that follow doctitle', () => {
      const input = heredoc`
      = Title

      == Level 1

      content

      === Level 2

      ==== Level 3

      ===== Level 4

      ====== Level 5

      ======= just content

      more content

      == Another Level 1
      `
      const expected = heredoc`
      # Title

      ## Level 1

      content

      ### Level 2

      #### Level 3

      ##### Level 4

      ###### Level 5

      ======= just content

      more content

      ## Another Level 1
      `
      assert.equal(downdoc(input), expected)
    })

    it('should process document that starts with section title', () => {
      const input = heredoc`
      == First Steps

      Let's get started!
      `
      const expected = heredoc`
      ## First Steps

      Let’s get started!
      `
      assert.equal(downdoc(input), expected)
    })

    it('should process document that starts with discrete heading', () => {
      const input = heredoc`
      [discrete#tagline]
      == Your Way

      When we say <<tagline>>, we mean it.
      `
      const expected = heredoc`
      ## Your Way

      When we say [Your Way](#your-way), we mean it.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not treat level-0 discrete heading at top of document as document title', () => {
      const input = heredoc`
      [discrete]
      = Heading
      Author Name

      {doctitle}
      `
      const expected = heredoc`
      # Heading
      Author Name

      {doctitle}
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert part titles', () => {
      const input = heredoc`
      = Title
      :doctype: book

      = First Steps

      = Fundamentals

      = Going Further
      `
      const expected = heredoc`
      # Title

      # First Steps

      # Fundamentals

      # Going Further
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert part title when document has no title', () => {
      const input = heredoc`
      :doctype: book
      This is the preface, not an author line.

      = First Steps

      == Installation
      `
      const expected = heredoc`
      This is the preface, not an author line.

      # First Steps

      ## Installation
      `
      assert.equal(downdoc(input), expected)
    })

    it('should drop section title directly adjacent to document header', () => {
      const input = heredoc`
      = Title
      == First Steps

      == Fundamentals

      == Going Further
      `
      const expected = heredoc`
      # Title

      ## Fundamentals

      ## Going Further
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert line with heading marker only as paragraph text', () => {
      const input = '=='
      assert.equal(downdoc(input), input)
    })

    it('should convert line with heading marker followed by multiple spaces as paragraph text', () => {
      const input = heredoc`
      ==    Heading with Leading Spaces Trimmed

      ==

      fin
      `
      const expected = heredoc`
      ## Heading with Leading Spaces Trimmed

      ==

      fin`
      assert.equal(downdoc(input.replace('\n==\n', '\n==  \n')), expected.replace('\n==\n', '\n==  \n'))
    })

    it('should clear block attributes after processing section title', () => {
      const input = heredoc`
      [,java]
      == Section Title
      ----
      plain listing block
      ----
      `
      const expected = heredoc`
      ## Section Title
      \`\`\`
      plain listing block
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should apply normal substitutions to section title', () => {
      const input = heredoc`
      :plugin: ACME Integration
      :url-host: https://cloud.example.org

      == *Search* for {plugin} on {url-host}[host]

      content
      `
      const expected = heredoc`
      ## **Search** for ACME Integration on [host](https://cloud.example.org)

      content
      `
      assert.equal(downdoc(input), expected)
    })
  })

  describe('block titles', () => {
    it('should convert block title above literal paragraph', () => {
      const input = heredoc`
      .Usage
       downdoc [OPTION]... FILE
      `
      const expected = heredoc`
      **Usage**

          downdoc [OPTION]... FILE
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert block title with ID above literal paragraph', () => {
      const input = heredoc`
      .Usage
      [#usage]
       downdoc [OPTION]... FILE
      `
      const expected = heredoc`
      <a name="usage"></a>**Usage**

          downdoc [OPTION]... FILE
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert block title with ID above verbatim block', () => {
      const input = heredoc`
      .Hello, World!
      [source#hello,ruby]
      ----
      puts 'Hello, World!'
      ----
      `
      const expected = heredoc`
      <a name="hello"></a>**Hello, World!**

      \`\`\`ruby
      puts 'Hello, World!'
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert block title with ID above block image', () => {
      const input = heredoc`
      .Package Explorer
      [#package-explorer]
      image::package-explorer-screenshot.png[Package Explorer]
      `
      const expected = heredoc`
      <a name="package-explorer"></a>**Package Explorer**

      ![Package Explorer](package-explorer-screenshot.png)
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert block title above delimited quote block', () => {
      const input = heredoc`
      .Words to code by
      ____
      Test, always test.
      ____
      `
      const expected = heredoc`
      **Words to code by**

      > Test, always test.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert block title with ID above delimited quote block', () => {
      const input = heredoc`
      [#test-test-test]
      .Words to code by
      ____
      Test, always test.
      ____
      `
      const expected = heredoc`
      <a name="test-test-test"></a>**Words to code by**

      > Test, always test.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert block title that begins with .', () => {
      const input = heredoc`
      ..npmrc
      ----
      omit=optional
      ----
      `
      const expected = heredoc`
      **.npmrc**

      \`\`\`
      omit=optional
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert block title on consecutive blocks', () => {
      const input = heredoc`
      .Purpose
      To convert AsciiDoc to Markdown.

      .In Action
      image::screenshot.png[Screenshot]
      `
      const expected = heredoc`
      **Purpose**

      To convert AsciiDoc to Markdown.

      **In Action**

      ![Screenshot](screenshot.png)
      `
      assert.equal(downdoc(input), expected)
    })

    it('should ignore dangling block title', () => {
      const input = heredoc`
      last paragraph

      .dangling block title
      `
      const expected = 'last paragraph'
      assert.equal(downdoc(input), expected)
    })

    it('should ignore block title above section title', () => {
      const input = heredoc`
      = Document Title

      .ignored block title
      == Section Title

      content
      `
      const expected = heredoc`
      # Document Title

      ## Section Title

      content
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not apply strong emphasis to block title with emphasis', () => {
      const input = heredoc`
      = Title

      .*To make butter:*
      . Mix ingredients
      . Chill
      . Whip
      `
      const expected = heredoc`
      # Title

      **To make butter:**

      1. Mix ingredients
      2. Chill
      3. Whip
      `
      assert.equal(downdoc(input), expected)
    })

    it('should apply normal substitutions to title of verbatim block', () => {
      const input = heredoc`
      :product: ACME Cloud
      :url-host: https://cloud.example.org

      .Configuration using {product} on {url-host}[host]
      ----
      auto=true
      ----
      `
      const expected = heredoc`
      **Configuration using ACME Cloud on [host](https://cloud.example.org)**

      \`\`\`
      auto=true
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should add anchor to block with title and ID attached to list item', () => {
      const input = heredoc`
      = Title

      * list item
      +
      .Configuration Example In List
      [#ex-in-list]
      ----
      key: value
      ----
      `
      const expected = heredoc`
      # Title

      * list item

        <a name="ex-in-list"></a>**Configuration Example In List**

        \`\`\`
        key: value
        \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not add anchor to verbatim block with only ID', () => {
      const input = heredoc`
      = Title

      [#ex1]
      ----
      key: value
      ----
      `
      const expected = heredoc`
      # Title

      \`\`\`
      key: value
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not process . on a line by itself as a block title', () => {
      const input = heredoc`
      before

      .

      after
      `
      assert.equal(downdoc(input), input)
    })
  })

  describe('paragraphs', () => {
    it('should preserve newlines in paragraph', () => {
      const input = heredoc`
      first line
      second line
      last line
      `
      assert.equal(downdoc(input), input)
    })

    it('should collapse newlines in paragraph if markdown-unwrap-prose attribute is set', () => {
      const input = heredoc`
      no
      newlines
      here
      `
      const expected = 'no newlines here'
      assert.equal(downdoc(input, { attributes: { 'markdown-unwrap-prose': '' } }), expected)
    })

    it('should treat ellipsis at start of paragraph as content not a block title', () => {
      const input = heredoc`
      ...and to *home*
      we shall go!
      `
      const expected = heredoc`
      ...and to **home**
      we shall go!
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not process section title within a paragraph', () => {
      const input = heredoc`
      Let the paragraph begin.
      == only starts a section title outside of a paragraph.
      `
      assert.equal(downdoc(input), input)
    })

    it('should not process attribute entry within a paragraph', () => {
      const input = heredoc`
      Let the paragraph begin.
      :name: declares an attibute in the document header.
      `
      assert.equal(downdoc(input), input)
    })

    it('should not process block title within a paragraph', () => {
      const input = heredoc`
      Let the paragraph begin.
      .hidden.adoc is a hidden file.
      `
      assert.equal(downdoc(input), input)
    })

    it('should not process indented line within a paragraph', () => {
      const input = heredoc`
      Let the paragraph begin.
        This paragraph uses a hanging indent.
      `
      assert.equal(downdoc(input), input)
    })

    it('should not process admonition label within a paragraph', () => {
      const input = heredoc`
      = Title

      Look
      for the
      NOTE: prefix.
      `
      const expected = heredoc`
      # Title

      Look
      for the
      NOTE: prefix.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not process toc::[] macro within a paragraph', () => {
      const input = heredoc`
      Let the paragraph begin.
      When you see this line outside a paragraph:
      toc::[]
      it will be replaced with the table of contents.
      `
      assert.equal(downdoc(input), input)
    })

    it('should convert paragraph prefixed with admonition label', () => {
      const input = heredoc`
      = Title
      :milk-type: oat

      NOTE: Remember the {milk-type} milk.

      IMPORTANT: Don't forget the children!

      TIP: Look for the https://en.wikipedia.org/wiki/Warp_(video_games)[warp] under the bridge.

      CAUTION: Slippery when wet.

      WARNING: The software you're about to use has *not* been tested.
      `
      const expected = heredoc`
      # Title

      **📌 NOTE**\\
      Remember the oat milk.

      **❗ IMPORTANT**\\
      Don’t forget the children!

      **💡 TIP**\\
      Look for the [warp](https://en.wikipedia.org/wiki/Warp_(video_games)) under the bridge.

      **🔥 CAUTION**\\
      Slippery when wet.

      **⚠️ WARNING**\\
      The software you’re about to use has **not** been tested.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not add hard line break mark to admonition label if text resolves to empty', () => {
      const input = heredoc`
      = Title

      CAUTION: {empty}
      `
      const expected = heredoc`
      # Title

      **🔥 CAUTION**
      `
      assert.equal(downdoc(input), expected)
    })

    it('should allow hard line break mark for admonition to be configured using markdown-line-break attribute', () => {
      const input = heredoc`
      = Title
      :markdown-line-break:

      CAUTION: Slippery when wet.
      `
      const expected = heredoc`
      # Title

      **🔥 CAUTION**
      Slippery when wet.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should promote ID on paragraph to inline anchor', () => {
      const input = heredoc`
      = Title

      [#p-1]
      This is the first paragraph.
      `
      const expected = heredoc`
      # Title

      <a name="p-1"></a>This is the first paragraph.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should ignore role on paragraph', () => {
      const input = heredoc`
      = Title

      [.lead]
      This is the lead paragraph.
      `
      const expected = heredoc`
      # Title

      This is the lead paragraph.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should end paragraph at next block attribute line', () => {
      const input = heredoc`
      The paragraph before <<idname>>.
      [#idname]
      == Section Title
      `
      const expected = heredoc`
      The paragraph before [Section Title](#section-title).
      ## Section Title
      `
      assert.equal(downdoc(input), expected)
    })

    it('should end literal paragraph at next block attribute line', () => {
      const input = heredoc`
       literal
       paragraph
      []
      paragraph

       more
       literal
      [foo:: bar]
      paragraph
      `
      const expected = heredoc`
          literal
          paragraph
      paragraph

          more
          literal
      paragraph
      `
      assert.equal(downdoc(input), expected)
    })

    it('should end list and literal paragraph in list at next block attribute line', () => {
      const input = heredoc`
      . yin

       foo
      []
      bar
      . baz

      . yang
      `
      const expected = heredoc`
      1. yin

             foo
      bar
      . baz

      1. yang
      `
      assert.equal(downdoc(input), expected)
    })
  })

  describe('breaks', () => {
    it('should convert hard line break in a paragraph', () => {
      const input = heredoc`
      roses are red, +
      violets are blue.
      `
      const expected = heredoc`
      roses are red,\\
      violets are blue.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should add hard line break character if hardbreaks option is set on paragraph', () => {
      const input = heredoc`
      [%hardbreaks]
      three
      two
      one
      blast off!
      `
      const expected = heredoc`
      three\\
      two\\
      one\\
      blast off!
      `
      assert.equal(downdoc(input), expected)
    })

    it('should allow hard line break mark for paragraph to be configured using markdown-line-break attribute', () => {
      const input = heredoc`
      roses are red, +
      violets are blue.
      `
      const expected = heredoc`
      roses are red,
      violets are blue.
      `
      const attributes = { 'markdown-line-break': '  ' }
      assert.equal(downdoc(input, { attributes }), expected.replace('red,', 'red,  '))
    })

    it('should convert hard line break on line by itself only if within a paragraph', () => {
      const input = heredoc`
      foo
       +
      bar

       +

       +
      baz
      `
      const expected = heredoc`
      foo
      \\
      bar

          +

          +
      baz
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not convert hard line break in a block title', () => {
      const input = heredoc`
      .what color? +
      red
      `
      const expected = heredoc`
      **what color? +**

      red
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not look for hard line break if previous line is empty', () => {
      const input = heredoc`
      foo

      {empty}
      bar
      `
      const expected = heredoc`
      foo


      bar
      `
      assert.equal(downdoc(input, { attributes: { empty: '' } }), expected)
    })

    it('should convert thematic breaks', () => {
      const input = heredoc`
      '''

      ---

      ***
      `
      const expected = heredoc`
      ---

      ---

      ---
      `
      assert.equal(downdoc(input), expected)
    })
  })

  describe('delimited blocks', () => {
    it('should drop block delimiters for example and sidebar blocks', () => {
      const input = heredoc`
      = Title

      ====
      This paragraph is promoted to the top level.
      ====

      This is already a top-level paragraph.

      ****
      This paragraph is also promoted to the top level.
      ****

      ****
      ====
      Even this paragraph is promoted to the top level.
      ====
      ****
      `
      const expected = heredoc`
      # Title

      This paragraph is promoted to the top level.

      This is already a top-level paragraph.

      This paragraph is also promoted to the top level.

      Even this paragraph is promoted to the top level.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should support block title with ID on example block', () => {
      const input = heredoc`
      = Title

      .A paragraph
      [#ex-p]
      ====
      This is a paragraph.
      ====
      `
      const expected = heredoc`
      # Title

      <a name="ex-p"></a>**A paragraph**

      This is a paragraph.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should unwrap example block with title that encloses verbatim block with title', () => {
      const input = heredoc`
      = Title

      .Something like this
      ====
      .Verbatim title
      ....
      verbatim content
      ....
      ====

      == Following Section

      content
      `
      const expected = heredoc`
      # Title

      **Something like this**

      **Verbatim title**

      \`\`\`
      verbatim content
      \`\`\`

      ## Following Section

      content
      `
      assert.equal(downdoc(input), expected)
    })

    it('should support block title on sidebar block', () => {
      const input = heredoc`
      = Title

      .Stuff you will skip
      ====
      If you saw this in a text book, you would likely skip it.
      Or would you?
      ====
      `
      const expected = heredoc`
      # Title

      **Stuff you will skip**

      If you saw this in a text book, you would likely skip it.
      Or would you?
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not convert section title inside delimited block', () => {
      const input = heredoc`
      = Title

      ====
      == Not a Section Title
      ====
      `
      const expected = heredoc`
      # Title

      == Not a Section Title
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert discrete heading inside delimited block', () => {
      const input = heredoc`
      = Title

      ====
      [discrete]
      == Heading

      Explain this example here.
      ====
      `
      const expected = heredoc`
      # Title

      ## Heading

      Explain this example here.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert admonition block', () => {
      const input = heredoc`
      = Title

      [WARNING]
      ====
      Beware of dog.

      Oh, and watch out for zombies too.
      ====
      `
      const expected = heredoc`
      # Title

      <dl><dt><strong>⚠️ WARNING</strong></dt><dd>

      Beware of dog.

      Oh, and watch out for zombies too.
      </dd></dl>
      `
      assert.equal(downdoc(input), expected)
    })

    it('should support block title with ID on admonition block', () => {
      const input = heredoc`
      = Title

      .Key points to remember
      [IMPORTANT#key-points]
      ====
      * Verify your sources.
      * Cite your references.
      * Proofread!
      ====
      `
      const expected = heredoc`
      # Title

      <dl><dt><strong><a name="key-points"></a>❗ IMPORTANT: Key points to remember</strong></dt><dd>

      * Verify your sources.
      * Cite your references.
      * Proofread!
      </dd></dl>
      `
      assert.equal(downdoc(input), expected)
    })

    it('should ignore unknown admonition type', () => {
      const input = heredoc`
      = Title

      [INFO]
      ====
      Not a valid admonition type.

      You will just see paragraphs.
      ====
      `
      const expected = heredoc`
      # Title

      Not a valid admonition type.

      You will just see paragraphs.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert collapsible block with title', () => {
      const input = heredoc`
      = Title

      .Reveal Answer
      [%collapsible]
      ====
      This is the answer.
      ====
      `
      const expected = heredoc`
      # Title

      <details>
      <summary>Reveal Answer</summary>

      This is the answer.
      </details>
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert collapsible block without title', () => {
      const input = heredoc`
      = Title

      [%collapsible]
      ====
      These are the details.
      ====
      `
      const expected = heredoc`
      # Title

      <details>
      <summary>Details</summary>

      These are the details.
      </details>
      `
      assert.equal(downdoc(input), expected)
    })

    it('should indent collapsible block attached to list item', () => {
      const input = heredoc`
      = Title

      . What is the square root of 4?
      +
      .Reveal Answer
      [%collapsible]
      ====
      2
      ====

      . What is the capital of Italy?
      +
      .Reveal Answer
      [%collapsible]
      ====
      Rome
      ====
      `
      const expected = heredoc`
      # Title

      1. What is the square root of 4?

         <details>
         <summary>Reveal Answer</summary>

         2
         </details>
      2. What is the capital of Italy?

         <details>
         <summary>Reveal Answer</summary>

         Rome
         </details>
      `
      assert.equal(downdoc(input), expected)
    })

    it('should start collapsible block open if open option is set', () => {
      const input = heredoc`
      = Title

      .Spoiler, sorry, not sorry
      [%collapsible%open]
      ====
      They made it out alive.
      ====
      `
      const expected = heredoc`
      # Title

      <details open>
      <summary>Spoiler, sorry, not sorry</summary>

      They made it out alive.
      </details>
      `
      assert.equal(downdoc(input), expected)
    })

    it('should process options on separate lines', () => {
      const input = heredoc`
      = Title

      .Spoiler, sorry, not sorry
      [%collapsible]
      [%open]
      ====
      They made it out alive.
      ====
      `
      const expected = heredoc`
      # Title

      <details open>
      <summary>Spoiler, sorry, not sorry</summary>

      They made it out alive.
      </details>
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert collapsible block to spoiler variant if markdown-collapsible-variant is spoiler', () => {
      const input = heredoc`
      = Title
      :subject: summary

      .Always visible {subject}
      [%collapsible]
      ====
      This text won't be visible until the user clicks the always visible text.

      TIP: Click *Always visible {subject}* to hide this text again.
      ====
      `
      const expected = heredoc`
      # Title

      \`\`\`spoiler Always visible summary
      This text won’t be visible until the user clicks the always visible text.

      **💡 TIP**\\
      Click **Always visible summary** to hide this text again.
      \`\`\`
      `
      assert.equal(downdoc(input, { attributes: { 'markdown-collapsible-variant': 'spoiler' } }), expected)
    })

    it('should convert collapsible block without title to spoiler', () => {
      const input = heredoc`
      = Title
      :markdown-collapsible-variant: spoiler

      [%collapsible]
      ====
      This is the spoiler.
      ====
      `
      const expected = heredoc`
      # Title

      \`\`\`spoiler
      This is the spoiler.
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should pass through content of passthrough block as is', () => {
      const input = heredoc`
      ++++
      <table>
      <tr>
      <td>cell</td>
      </tr>
      </table>
      ++++
      `
      const expected = heredoc`
      <table>
      <tr>
      <td>cell</td>
      </tr>
      </table>
      `
      assert.equal(downdoc(input), expected)
    })

    it('should support passthrough block inside another block', () => {
      const input = heredoc`
      .Click to show supporting data
      [%collapsible]
      ====
      ++++
      <table>
      <tr>
      <td>cell</td>
      </tr>
      </table>
      ++++
      ====
      `
      const expected = heredoc`
      <details>
      <summary>Click to show supporting data</summary>

      <table>
      <tr>
      <td>cell</td>
      </tr>
      </table>
      </details>
      `
      assert.equal(downdoc(input), expected)
    })

    it('should ignore block title on passthrough block', () => {
      const input = heredoc`
      .ignored
      ++++
      <aside>
      <p>just an aside</p>
      </aside>
      ++++
      `
      const expected = heredoc`
      <aside>
      <p>just an aside</p>
      </aside>
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert passthrough block with stem style to display (block) match', () => {
      const input = heredoc`
      [stem]
      ++++
      a^2 = b^2 + c^2
      ++++
      `
      const expected = heredoc`
      \`\`\`math
      a^2 = b^2 + c^2
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })
  })

  describe('tables', () => {
    it('should convert table with only body', () => {
      const input = heredoc`
      |===
      | A1 | B1
      | A2 | B2
      | A3 | B3
      |===
      `
      const expected = heredoc`
      |     |     |
      | --- | --- |
      | A1 | B1 |
      | A2 | B2 |
      | A3 | B3 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert table with header with implicit column count', () => {
      const input = heredoc`
      |===
      | Col A | Col B

      | A1
      | B1
      | A2
      | B2
      |===
      `
      const expected = heredoc`
      | Col A | Col B |
      | --- | --- |
      | A1 | B1 |
      | A2 | B2 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should collapse empty lines between rows', () => {
      const input = heredoc`
      |===
      | Col A | Col B

      | A1
      | B1


      | A2
      | B2
      |===
      `
      const expected = heredoc`
      | Col A | Col B |
      | --- | --- |
      | A1 | B1 |
      | A2 | B2 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert table with each row on its own line', () => {
      const input = heredoc`
      |===
      | Col A | Col B

      | A1 | B1
      | A2 | B2
      |===
      `
      const expected = heredoc`
      | Col A | Col B |
      | --- | --- |
      | A1 | B1 |
      | A2 | B2 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert table with ragged rows', () => {
      const input = heredoc`
      |===
      | Col A | Col B | Col C

      | A1
      | B1 | C1
      | A2 | B2 | C2 | A3
      | B3 | C3
      | A4
      | B4 | C4 | A5 | B5 | C5
      |===
      `
      const expected = heredoc`
      | Col A | Col B | Col C |
      | --- | --- | --- |
      | A1 | B1 | C1 |
      | A2 | B2 | C2 |
      | A3 | B3 | C3 |
      | A4 | B4 | C4 |
      | A5 | B5 | C5 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should end table at closing delimiter', () => {
      const input = heredoc`
      before

      |===
      | Name | Description

      | dryRun
      | Report what actions will be taken without doing them.
      |===

      after | not a table cell
      `
      const expected = heredoc`
      before

      | Name | Description |
      | --- | --- |
      | dryRun | Report what actions will be taken without doing them. |

      after | not a table cell
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not promote first row to header if preceded by empty line', () => {
      const input = heredoc`
      |===
      
      | A1

      | A2
      |===
      `
      const expected = heredoc`
      |     |
      | --- |
      | A1 |
      | A2 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert table with explicit header', () => {
      const input = heredoc`
      [%header]
      |===
      | Col A | Col B
      | A1
      | B1
      |===
      `
      const expected = heredoc`
      | Col A | Col B |
      | --- | --- |
      | A1 | B1 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not promote first row to header if noheader option is set', () => {
      const input = heredoc`
      [%noheader]
      |===
      | A1

      | A2
      |===
      `
      const expected = heredoc`
      |     |
      | --- |
      | A1 |
      | A2 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert table with header with explicit cols as repeater', () => {
      const input = heredoc`
      [cols=2*d]
      |===
      | Col A | Col B

      | A1
      | B1
      |===
      `
      const expected = heredoc`
      | Col A | Col B |
      | --- | --- |
      | A1 | B1 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert table with header with explicit cols with comma separator', () => {
      const input = heredoc`
      [cols="1,.^2"]
      |===
      | Col A | Col B

      | A1
      | B1
      |===
      `
      const expected = heredoc`
      | Col A | Col B |
      | --- | --- |
      | A1 | B1 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert table with header with explicit cols with semi-colon separator', () => {
      const input = heredoc`
      [cols=1;2d]
      |===
      | Col A | Col B

      | A1
      | B1
      |===
      `
      const expected = heredoc`
      | Col A | Col B |
      | --- | --- |
      | A1 | B1 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert table with explicit cols containing repeater and columns separated by comma', () => {
      const input = heredoc`
      [cols="2*d,1"]
      |===
      | Col A | Col B | Col C

      | A1
      | B1
      | C1
      |===
      `
      const expected = heredoc`
      | Col A | Col B | Col C |
      | --- | --- | --- |
      | A1 | B1 | C1 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert table with explicit cols containing repeater and columns separated by semi-colon', () => {
      const input = heredoc`
      [cols="2*d;2"]
      |===
      | Col A | Col B | Col C

      | A1
      | B1
      | C1
      |===
      `
      const expected = heredoc`
      | Col A | Col B | Col C |
      | --- | --- | --- |
      | A1 | B1 | C1 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert table with explicit cols defined in attribute followed by other attributes with quotes', () => {
      const input = heredoc`
      [%header,cols="20,20a",width="75%"]
      |===
      | A | B
      | A1
      | B1
      |===
      `
      const expected = heredoc`
      | A | B |
      | --- | --- |
      | A1 | B1 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert table with cols attribute followed by other attributes without quotes', () => {
      const input = heredoc`
      [%header,cols=>1;2d,width=75%,frame=none,grid=cols]
      |===
      | A | B
      | A1
      | B1
      |===
      `
      const expected = heredoc`
      | A | B |
      | --: | --- |
      | A1 | B1 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should honor horizontal column alignments in value of cols attribute', () => {
      const input = heredoc`
      [%header,cols=2*^.>10;>40;.^40]
      |===
      | A | B | C | D
      | A1
      | B1
      | C1
      | D1
      |===
      `
      const expected = heredoc`
      | A | B | C | D |
      | :-: | :-: | --: | --- |
      | A1 | B1 | C1 | D1 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should normalize space around cell text', () => {
      const input = heredoc`
      |===
      |Col A |  Col B  |   Col C

      |A1    |  B1   | C1

      |   A2 |     B2|  C2

      |foo|bar|baz
      |===
      `
      const expected = heredoc`
      | Col A | Col B | Col C |
      | --- | --- | --- |
      | A1 | B1 | C1 |
      | A2 | B2 | C2 |
      | foo | bar | baz |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should create empty header row if first row has less columns than specified', () => {
      const input = heredoc`
      [cols=3*]
      |===
      | A1
      | B1
      | C1
      | A2
      | B2
      | C2
      |===
      `
      const expected = heredoc`
      |     |     |     |
      | --- | --- | --- |
      | A1 | B1 | C1 |
      | A2 | B2 | C2 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should use first row to determine number of columns without creating header', () => {
      const input = heredoc`
      |===
      | A
      |===
      `
      const expected = heredoc`
      |     |
      | --- |
      | A |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert block title on table', () => {
      const input = heredoc`
      .Table caption
      |===
      | foo | bar

      | yin
      | yang
      |===
      `
      const expected = heredoc`
      **Table caption**

      | foo | bar |
      | --- | --- |
      | yin | yang |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert block title on table with no header', () => {
      const input = heredoc`
      .Table caption
      |===
      | foo | bar
      |===
      `
      const expected = heredoc`
      **Table caption**

      |     |     |
      | --- | --- |
      | foo | bar |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should support table with no empty lines attached to list item', () => {
      const input = heredoc`
      * list item
      +
      .Table caption
      |===
      | A | B

      | A1
      | B1
      | A2 | B2
      |===

      after
      `
      const expected = heredoc`
      * list item

        **Table caption**

        | A | B |
        | --- | --- |
        | A1 | B1 |
        | A2 | B2 |

      after
      `
      assert.equal(downdoc(input), expected)
    })

    it('should support table with empty lines attached to list item', () => {
      const input = heredoc`
      * list item
      +
      .Table caption
      |===
      | A | B

      | A1
      | B1

      | A2 | B2
      |===

      after
      `
      const expected = heredoc`
      * list item

        **Table caption**

        | A | B |
        | --- | --- |
        | A1 | B1 |
        | A2 | B2 |

      after
      `
      assert.equal(downdoc(input), expected)
    })

    it('should support table with explicit cols and ragged first row attached to list item', () => {
      const input = heredoc`
      * list item
      +
      [cols=3*]
      |===
      | A | B
      | C

      | A1
      | B1 | C1

      | A2 | B2
      | C2
      |===

      after
      `
      const expected = heredoc`
      * list item

        |     |     |     |
        | --- | --- | --- |
        | A | B | C |
        | A1 | B1 | C1 |
        | A2 | B2 | C2 |

      after
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not carry over block title on empty table to next adjacent block', () => {
      const input = heredoc`
      .Table caption
      |===
      |===
      ----
      verbatim
      ----
      `
      const expected = heredoc`
      \`\`\`
      verbatim
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert table header with wrapped text in final cell', () => {
      const input = heredoc`
      [%header]
      |===
      | A
      and no more
      |===

      [%header]
      |===
      | A | B
      more
      | A1
      | B1
      |===
      `
      const expected = heredoc`
      | A and no more |
      | --- |

      | A | B more |
      | --- | --- |
      | A1 | B1 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert cell with wrapped text at start of row', () => {
      const input = heredoc`
      [cols=2*]
      |===
      | Feature | Description

      | Autopilot
      Only available on certain models.
      Requires an autopilot subscription.
      | Drives the vehicle automatically.

      | Bluetooth audio
      Available on all models.
      | Plays music from an external device over bluetooth.
      |===
      `
      const expected = heredoc`
      | Feature | Description |
      | --- | --- |
      | Autopilot Only available on certain models. Requires an autopilot subscription. | Drives the vehicle automatically. |
      | Bluetooth audio Available on all models. | Plays music from an external device over bluetooth. |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert cell with wrapped text in subsequent column', () => {
      const input = heredoc`
      [cols=2*]
      |===
      | Feature | Description

      | Autopilot
      | Drives the vehicle automatically.
      Only available on certain models.
      Requires an autopilot subscription.

      | Bluetooth audio
      | Plays music from an external device over bluetooth.
      Available on all models.
      |===
      `
      const expected = heredoc`
      | Feature | Description |
      | --- | --- |
      | Autopilot | Drives the vehicle automatically. Only available on certain models. Requires an autopilot subscription. |
      | Bluetooth audio | Plays music from an external device over bluetooth. Available on all models. |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert cells with text starting on separate line', () => {
      const input = heredoc`
      |===
      | foo | bar

      |
      fizz
      |
      buzz
      |===
      `
      const expected = heredoc`
      | foo | bar |
      | --- | --- |
      | fizz | buzz |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should apply substitutions to cells in header row', () => {
      const input = heredoc`
      |===
      | _Emphasis_ | *Strong Emphasis* | https://example.org[Link]

      | text formatting
      | text formatting
      | macro
      |===
      `
      const expected = heredoc`
      | _Emphasis_ | **Strong Emphasis** | [Link](https://example.org) |
      | --- | --- | --- |
      | text formatting | text formatting | macro |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should apply substitutions to cells in body row', () => {
      const input = heredoc`
      |===
      | Emphasis | Strong Emphasis | Link

      | _emphasis_
      | *strong emphasis*
      *still strong*
      | https://example.org[link]
      https://example.com[another link]
      |===
      `
      const expected = heredoc`
      | Emphasis | Strong Emphasis | Link |
      | --- | --- | --- |
      | _emphasis_ | **strong emphasis** **still strong** | [link](https://example.org) [another link](https://example.com) |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert hardbreak character at end wrapped line in table cell', () => {
      const input = heredoc`
      [cols=2*]
      |===
      | A +
      1
      | B +
      1
      |===
      `
      const expected = heredoc`
      |     |     |
      | --- | --- |
      | A<br> 1 | B<br> 1 |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not convert hardbreak character at end of table cell', () => {
      const input = heredoc`
      [cols=2*]
      |===
      | A
      1 +
      | B
      1 +
      |===
      `
      const expected = heredoc`
      |     |     |
      | --- | --- |
      | A 1 + | B 1 + |
      `
      assert.equal(downdoc(input), expected)
    })
  })

  describe('text formatting', () => {
    it('should convert bold formatting', () => {
      const input = heredoc`
      = Title

      You *really* need to check *this* * out!
      `
      const expected = heredoc`
      # Title

      You **really** need to check **this** * out!
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not convert bold phrase inside a word', () => {
      const input = heredoc`
      *foo*bar

      foo[.role]*bar*

      *_foo or *_bar

      *l'*élection

      é*t*é
      `
      const expected = heredoc`
      *foo*bar

      foo[.role]**bar**

      *_foo or *_bar

      *l'*élection

      é*t*é
      `
      assert.equal(downdoc(input), expected)
    })

    it('should leave escaped bold formatting escaped', () => {
      const input = heredoc`
      Use the syntax \\*phrase here* to render text in bold.

      \\*a becomes b*
      `
      assert.equal(downdoc(input), input)
    })

    it('should convert bold formatting in unordered list item', () => {
      const input = '* be *bold*'
      const expected = '* be **bold**'
      assert.equal(downdoc(input), expected)
    })

    it('should convert italic formatting', () => {
      const input = heredoc`
      = Title

      The _ is _so_ incredibly _useful_ when making snake_case.
      `
      const expected = heredoc`
      # Title

      The _ is _so_ incredibly _useful_ when making snake_case.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not convert italic phrase inside a word', () => {
      const input = heredoc`
      foo[.role]_bar_

      [.conj]_l'_élection

      é[.role]*t*é
      `
      const expected = heredoc`
      foo[.role]_bar_

      [.conj]_l'_élection

      é[.role]*t*é
      `
      assert.equal(downdoc(input), expected)
    })

    it('should leave escaped italic formatting escaped', () => {
      const input = heredoc`
      Use the syntax [.example]\\_phrase here_ to render text in italic.

      \\_layouts or layouts_ contain the layout files.
      `
      assert.equal(downdoc(input), input)
    })

    it('should convert bold italic formatting in specific order', () => {
      const input = heredoc`
      = Title

      If you really want to put some _*emphasis*_ on it, use *_bold italic_*.
      `
      const expected = heredoc`
      # Title

      If you really want to put some _*emphasis*_ on it, use **_bold italic_**.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert monospace formatting', () => {
      const input = heredoc`
      = Title

      A boolean value can be \`true\` or \`false\`.

      In Java, a boolean is designated by the [.keyword]\`boolean\` keyword.
      `
      const expected = heredoc`
      # Title

      A boolean value can be \`true\` or \`false\`.

      In Java, a boolean is designated by the \`boolean\` keyword.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not escape < inside monospace phrase', () => {
      const input = heredoc`
      The name of an XML tag is enclosed in \`<\` and \`>\` characters, such as \`<root>\`.

      An inline macro follows the format \`<name>:<target>[<attrlist>]\`.
      `
      assert.equal(downdoc(input), input)
    })

    it('should escape < outside of monospace phrase', () => {
      const input = heredoc`
      = Title

      a < b < c

      * List<Object>
      `
      const expected = heredoc`
      # Title

      a &lt; b &lt; c

      * List&lt;Object>
      `
      assert.equal(downdoc(input), expected)
    })

    it('should remove backslashes in front of URL or ellipsis in monospace phrase', () => {
      const input = heredoc`
      = Title

      Use the \`\\\` character to escape special syntax.

      Visit \`\\http://localhost:8080\` or \`\\http://127.0.0.1:8080\` in your browser to see a preview.

      The text \`lorem ipsum\\...\` will be replaced with the real content.

      All I hear is \`\\...yada, yada, yada\\...\`.

      Use \`\\xref:page.adoc#fragment[]\` to link to a fragment in another page.
      `
      const expected = heredoc`
      # Title

      Use the \`\\\` character to escape special syntax.

      Visit \`http://localhost:8080\` or \`http://127.0.0.1:8080\` in your browser to see a preview.

      The text \`lorem ipsum...\` will be replaced with the real content.

      All I hear is \`...yada, yada, yada...\`.

      Use \`xref:page.adoc#fragment[]\` to link to a fragment in another page.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should remove passthrough formatting marks in literal monospace phrase', () => {
      const input = heredoc`
      = Title

      Formatting is not interpretted within a \`+literal monospace+\` phrase.

      The target of an inline macro is preceded by \`+:+\` and followed by an attrlist enclosed in \`+[]+\`.
      `
      const expected = heredoc`
      # Title

      Formatting is not interpretted within a \`literal monospace\` phrase.

      The target of an inline macro is preceded by \`:\` and followed by an attrlist enclosed in \`[]\`.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should automatically escape attribute references in literal monospace phrase', () => {
      const input = heredoc`
      = Title
      :owner: opendevise
      :repo: downdoc

      Use the endpoint \`+/{owner}/{repo}+\` to get information about the repository.
      `
      const expected = heredoc`
      # Title

      Use the endpoint \`/{owner}/{repo}\` to get information about the repository.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not try to escape lone { in literal monospace phrase', () => {
      const input = heredoc`
      = Title

      An attribute reference is an attribute name surrounded by \`+{+\` and \`+}+\`.
      `
      const expected = heredoc`
      # Title

      An attribute reference is an attribute name surrounded by \`{\` and \`}\`.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not try to escape { not followed by attribute name in literal monospace phrase', () => {
      const input = heredoc`
      = Title

      The range \`+{1..9}+\` represents all non-zero numbers.
      `
      const expected = heredoc`
      # Title

      The range \`{1..9}\` represents all non-zero numbers.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert marked phrase', () => {
      const input = heredoc`
      = Title

      #highlight this# to remember it later.
      `
      const expected = heredoc`
      # Title

      <mark>highlight this</mark> to remember it later.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not convert marked phrase inside a word', () => {
      const input = heredoc`
      #foo#bar

      foo[.role]#bar#

      #_foo or #_bar

      #l'#élection

      é#t#é
      `
      const expected = heredoc`
      #foo#bar

      foo[.role]<mark>bar</mark>

      #_foo or #_bar

      #l'#élection

      é#t#é
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not convert character reference as marked phrase', () => {
      const input = heredoc`
      &#169; and &#174; are trademark symbols

      [.role]#&169; and [.role]&#174; should be left as is.
      `
      assert.equal(downdoc(input), input)
    })

    it('should leave escaped marked phrase escaped', () => {
      const input = heredoc`
      Use the syntax \\#phrase here# to highlight text.

      \\#hashtag is a tag or a URL fragment, but not a phone#
      `
      assert.equal(downdoc(input), input)
    })

    it('should convert phrase with line-through role', () => {
      const input = heredoc`
      = Title

      [.line-through]#strike it#, that was incorrect.
      `
      const expected = heredoc`
      # Title

      ~~strike it~~, that was incorrect.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should allow strikethrough mark to be configured using markdown-strikethrough attribute', () => {
      const input = heredoc`
      = Title
      :markdown-strikethrough: ~

      [.line-through]#strike it#, that was incorrect.
      `
      const expected = heredoc`
      # Title

      ~strike it~, that was incorrect.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should allow strikethrough tag pair to be configured using markdown-strikethrough attribute', () => {
      const input = heredoc`
      = Title

      [.line-through]#strike it#, that was incorrect.
      `
      const expected = heredoc`
      # Title

      <s>strike it</s>, that was incorrect.
      `
      assert.equal(downdoc(input, { attributes: { 'markdown-strikethrough': '<s> </s>' } }), expected)
    })

    it('should convert generic phrase with role', () => {
      const input = heredoc`
      = Title

      Something [.special]#special#.
      `
      const expected = heredoc`
      # Title

      Something special.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert directly adjacent marked phrases with or without role', () => {
      const input = heredoc`
      = Title

      #no##footer#

      [.basename]#script#[.ext]#.js#
      `
      const expected = heredoc`
      # Title

      <mark>no</mark><mark>footer</mark>

      script.js
      `
      assert.equal(downdoc(input), expected)
    })

    it('should drop boxed attrlist in front of formatted text', () => {
      const input = heredoc`
      = Title

      Use downdoc to convert [.path]_README.adoc_ to [.path]_README.md_ *before* publishing [.path]_downdoc.tgz_.

      [x]_foo_bar
      `
      const expected = heredoc`
      # Title

      Use downdoc to convert _README.adoc_ to _README.md_ **before** publishing _downdoc.tgz_.

      [x]_foo_bar
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not be greedy when matching boxed attrlist on formatted text', () => {
      const input = heredoc`
      = Title

      key: [ "before [.redacted]#redacted# after" ]

      [[bold]]*bold*

      [[italic]]_italic_

      [[marked]]#marked#
      `
      const expected = heredoc`
      # Title

      key: [ "before redacted after" ]

      <a name="bold"></a>**bold**

      <a name="italic"></a>_italic_

      <a name="marked"></a><mark>marked</mark>
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert formatted text with single character', () => {
      const input = heredoc`
      *b*

      [.path]_._

      \`<\`

      "\`q\`"

      #h#
      `
      const expected = heredoc`
      **b**

      _._

      \`<\`

      <q>q</q>

      <mark>h</mark>
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not drop line that starts with formatting text with attribute list', () => {
      const input = heredoc`
      = Title

      [.path]_README.adoc_ contains all the essential information.
      `
      const expected = heredoc`
      # Title

      _README.adoc_ contains all the essential information.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should replace quotes around double quoted text', () => {
      const input = heredoc`
      Before you say "\`no way\`", I say "\`try before you deny\`".

      That "\`bug\`" is actually a feature of the software.
      `
      const expected = heredoc`
      Before you say <q>no way</q>, I say <q>try before you deny</q>.

      That <q>bug</q> is actually a feature of the software.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should replace quotes around single quoted text', () => {
      const input = heredoc`
      = Title

      Accept the terms by typing '\`yes\`' when prompted.
      `
      const expected = heredoc`
      # Title

      Accept the terms by typing <q>yes</q> when prompted.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should allow double smart quotes replacement to be controlled by quotes attribute', () => {
      const input = heredoc`
      :quotes: “ ”

      Before you say "\`no way\`", I say "\`try before you deny\`".

      That "\`bug\`" is actually a feature of the software.
      `
      const expected = heredoc`
      Before you say “no way”, I say “try before you deny”.

      That “bug” is actually a feature of the software.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should substitute curly apostrophe', () => {
      const input = heredoc`
      That\`'s probably not going to work.

      That's probably not going to work.

      The \`'90s was the heydey of alternative rock.

      Ruby 2.6's endless range operator is a useful addition.

      Qu'est ce qu'AsciiDoc ?

      Enclose the value in single quotes (\`'\`) to apply normal substitutions to it.

      6'5"

      x'

      \`'
      `
      const expected = heredoc`
      That’s probably not going to work.

      That’s probably not going to work.

      The ’90s was the heydey of alternative rock.

      Ruby 2.6’s endless range operator is a useful addition.

      Qu’est ce qu’AsciiDoc ?

      Enclose the value in single quotes (\`'\`) to apply normal substitutions to it.

      6'5"

      x'

      ’
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert formatted text before replacing attribute references', () => {
      const input = heredoc`
      = Title
      :bold: *not actually bold*

      {bold}
      `
      const expected = heredoc`
      # Title

      *not actually bold*
      `
      assert.equal(downdoc(input), expected)
    })

    it('should replace inline anchor with anchor tag', () => {
      const input = heredoc`
      You can learn about <<foo,foo>>, <<bar,bar>>, and <<baz,baz>>.

      [[foo]]all about foo

      * [[bar]]all about bar

      |===
      | [[baz]]all about baz
      |===
      `
      const expected = heredoc`
      You can learn about [foo](#foo), [bar](#bar), and [baz](#baz).

      <a name="foo"></a>all about foo

      * <a name="bar"></a>all about bar

      |     |
      | --- |
      | <a name="baz"></a>all about baz |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should put inline anchor in block title if paragraph has ID and block title', () => {
      const input = heredoc`
      To learn more, come <<chat>>

      .Chat with us!
      [#chat]
      You can communicate with project members and fellow users in the community chat.
      `
      const expected = heredoc`
      To learn more, come [Chat with us!](#chat)

      <a name="chat"></a>**Chat with us!**

      You can communicate with project members and fellow users in the community chat.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should ignore inline anchor with invalid syntax', () => {
      const input = heredoc`
      = Title

      [[text inside]]text outside
      `
      const expected = heredoc`
      # Title

      [[text inside]]text outside
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert inline stem macro and unescape escaped closing square bracket', () => {
      const input = heredoc`
      = Title

      The solution is stem:[x^2 + y^2].

      We arrive at stem:[4 \\times [(3 + 2) \\times 6\\]].
      `
      const expected = heredoc`
      # Title

      The solution is $x^2 + y^2$.

      We arrive at $4 \\times [(3 + 2) \\times 6]$.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should handle multiple stem macros in same line', () => {
      const input = 'stem:[x+y] and stem:[a*b]'
      const expected = '$x+y$ and $a*b$'
      assert.equal(downdoc(input), expected)
    })

    it('should not apply text formatting to stem expression', () => {
      const input = 'stem:[a**b**c]'
      const expected = '$a**b**c$'
      assert.equal(downdoc(input), expected)
    })

    it('should not apply text formatting to stem expression when enclosed in text formatting', () => {
      const input = '*stem:[V^{**}]*'
      const expected = '**$V^{**}$**'
      assert.equal(downdoc(input), expected)
    })
  })

  describe('xrefs', () => {
    it('should convert internal xrefs', () => {
      const input = heredoc`
      = Title
      :idprefix:
      :idseparator: -

      == First Section

      Go to the <<second-section,next section>> or skip to <<#fin, the end>>.

      == Second Section

      Go to the xref:first-section[previous section] or continue to xref:#fin[the end].

      == Fin

      The end.
      `
      const expected = heredoc`
      # Title

      ## First Section

      Go to the [next section](#second-section) or skip to [the end](#fin).

      ## Second Section

      Go to the [previous section](#first-section) or continue to [the end](#fin).

      ## Fin

      The end.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert internal xrefs when using default idprefix and idseparator', () => {
      const input = heredoc`
      = Title

      See <<#_foo_bar,Bar>> or xref:#_foo_baz[Baz].

      == Foo Bar

      == Foo Baz
      `
      const expected = heredoc`
      # Title

      See [Bar](#foo-bar) or [Baz](#foo-baz).

      ## Foo Bar

      ## Foo Baz
      `
      assert.equal(downdoc(input), expected)
    })

    it('should unescape escaped xref macro', () => {
      const input = heredoc`
      = Title

      Use the syntax \\xref:page.adoc#fragment[] to link to a fragment in another page.
      `
      const expected = heredoc`
      # Title

      Use the syntax xref:page.adoc#fragment[] to link to a fragment in another page.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not match internal xref macro if ID contains space characters', () => {
      const input = heredoc`
      = Title

      An internal xref macro starts with xref:#target and ends with [].
      `
      const expected = heredoc`
      # Title

      An internal xref macro starts with xref:#target and ends with [].
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not match interdocument xref macro if fragment contains space characters', () => {
      const input = heredoc`
      = Title

      xref:doc.adoc# may be followed by a fragment before the [].
      `
      const expected = heredoc`
      # Title

      xref:doc.adoc# may be followed by a fragment before the [].
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not match xref shorthand if ID contains space characters', () => {
      const input = heredoc`
      = Title

      The target of a shorthand xref is enclosed in \`<< >>\`.

      << and >> are the ASCII equivalent of double quotes in French.
      `
      const expected = heredoc`
      # Title

      The target of a shorthand xref is enclosed in \`<< >>\`.

      &lt;&lt; and >> are the ASCII equivalent of double quotes in French.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should match shorthand xref inside monospace phrase', () => {
      const input = heredoc`
      = Title

      Use the \`<<replace>>\` method to replace characters in a string.

      [#replace]
      == replace

      All about the replace method.
      `
      const expected = heredoc`
      # Title

      Use the \`[replace](#replace)\` method to replace characters in a string.

      ## replace

      All about the replace method.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert natural xref', () => {
      const input = heredoc`
      = Title

      <<Install>> xref:Section Title with Spaces[]

      == Install

      == Section Title with Spaces
      `
      const expected = heredoc`
      # Title

      [Install](#install) [Section Title with Spaces](#section-title-with-spaces)

      ## Install

      ## Section Title with Spaces
      `
      assert.equal(downdoc(input), expected)
    })

    it('should match natural xref against first occurrence of title', () => {
      const input = heredoc`
      = Title

      <<Get Started>>

      [#get-started-1]
      == Get Started

      [#get-started-2]
      == Get Started
      `
      const expected = heredoc`
      # Title

      [Get Started](#get-started)

      ## Get Started

      ## Get Started
      `
      assert.equal(downdoc(input), expected)
    })

    it('should fill in text for backward xref', () => {
      const input = heredoc`
      = HOWTO
      :idprefix:
      :idseparator: -

      == System Requirements

      A computer connected to the internet.

      == Usage

      Be sure you have read the <<system-requirements>>.
      `
      const expected = heredoc`
      # HOWTO

      ## System Requirements

      A computer connected to the internet.

      ## Usage

      Be sure you have read the [System Requirements](#system-requirements).
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not fill in text for xref to doctitle without explicit ID', () => {
      const input = heredoc`
      = HOWTO

      In this <<_howto>>, you will learn how to do stuff.
      `
      const expected = heredoc`
      # HOWTO

      In this [_howto](#_howto), you will learn how to do stuff.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should fill in text for xref to doctitle with explicit ID', () => {
      const input = heredoc`
      [#howto]
      = HOWTO downdoc

      In this <<howto>>, you will learn {doctitle}.
      `
      const expected = heredoc`
      # HOWTO downdoc

      In this [HOWTO downdoc](#howto-downdoc), you will learn HOWTO downdoc.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should fill in text for forward xref', () => {
      const input = heredoc`
      = Title
      :idprefix:

      == System Requirements

      A computer connected to the internet.
      Once you have that, move on to <<usage>>.

      == Usage

      Let's get started.
      `
      const expected = heredoc`
      # Title

      ## System Requirements

      A computer connected to the internet.
      Once you have that, move on to [Usage](#usage).

      ## Usage

      Let’s get started.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should use fill in text using reftext of target block with ID, title, and reftext', () => {
      const input = heredoc`
      = Title

      To get your feet wet, first try <<hello>>.

      .Hello, World example
      [[hello,Hello, World!]]
      ----
      puts 'hi'
      ----
      `
      const expected = heredoc`
      # Title

      To get your feet wet, first try [Hello, World!](#hello).

      <a name="hello"></a>**Hello, World example**

      \`\`\`
      puts 'hi'
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should honor idprefix and idseparator when mapping autogenerated IDs', () => {
      const input = heredoc`
      = Title
      :idprefix: ref_
      :idseparator: -

      == System Requirements

      == Get Started

      Check the <<ref_system-requirements>>, then <<ref_get-started>>.
      `
      const expected = heredoc`
      # Title

      ## System Requirements

      ## Get Started

      Check the [System Requirements](#system-requirements), then [Get Started](#get-started).
      `
      assert.equal(downdoc(input), expected)
    })

    it('should rewrite explicit ID to auto-generated ID and support explicit reftext', () => {
      const input = heredoc`
      = HOWTO

      You'll learn [how] to <<build>> and xref:deploy[] your site.

      [#build,reftext=Build]
      == Build Your Site

      Instructions go here.

      [[deploy, Deploy]]
      == Deploy Your Site

      Instructions go here.
      `
      const expected = heredoc`
      # HOWTO

      You’ll learn [how] to [Build](#build-your-site) and [Deploy](#deploy-your-site) your site.

      ## Build Your Site

      Instructions go here.

      ## Deploy Your Site

      Instructions go here.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should support both forms of block attribute line on same section title', () => {
      const input = heredoc`
      = HOWTO

      You'll learn how to xref:deploy[].

      [[deploy,Deploy]]
      [reftext=Go Live]
      == Deploy Your Site

      Instructions go here.
      `
      const expected = heredoc`
      # HOWTO

      You’ll learn how to [Go Live](#deploy-your-site).

      ## Deploy Your Site

      Instructions go here.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not match block anchor with invalid characters', () => {
      const input = heredoc`
      See <<-not-valid>>, <<.not.valid>>, <<$not-valid>>, <<0>>, or <<vérite>>.

      [[-not-valid]]
      == Nope

      [[.not.valid]]
      == Nope Again

      [[$not-valid]]
      == Still Nope

      [[0]]
      == Again Nope

      [[vérite]]
      == Yep
      `
      const expected = heredoc`
      See [-not-valid](#-not-valid), [.not.valid](#.not.valid), [$not-valid](#$not-valid), [0](#0), or [Yep](#yep).

      ## Nope

      ## Nope Again

      ## Still Nope

      ## Again Nope

      ## Yep
      `
      assert.equal(downdoc(input), expected)
    })

    it('should preserve escaped square brackets in xref text', () => {
      const input = heredoc`
      = Title
      :idprefix:
      :idseparator: -

      The next section covers the xref:array-of-strings[String\\[\\] type].

      [#array-of-strings]
      == Array of strings

      A type that represents multiple string values.
      `
      const expected = heredoc`
      # Title

      The next section covers the [String\\[\\] type](#array-of-strings).

      ## Array of strings

      A type that represents multiple string values.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should preserve escaped square brackets in xref text of xref enclosed in quotes', () => {
      const input = heredoc`
      = Title

      The next section covers the "\`xref:array-of-strings[String\\[\\] type]\`".

      [#array-of-strings]
      == Array of strings
      `
      const expected = heredoc`
      # Title

      The next section covers the <q>[String\\[\\] type](#array-of-strings)</q>.

      ## Array of strings
      `
      assert.equal(downdoc(input), expected)
    })

    it('should replace attribute reference in title of internal reference', () => {
      const input = heredoc`
      = Title
      :product: ACME

      Let's <<get-started>>.

      [[get-started]]
      == Get Started with {product}

      Let’s go!
      `
      const expected = heredoc`
      # Title

      Let’s [Get Started with ACME](#get-started-with-acme).

      ## Get Started with ACME

      Let’s go!
      `
      assert.equal(downdoc(input), expected)
    })

    it('should use ID as text for unresolved xref', () => {
      const input = heredoc`
      = Title

      Refer to <<webserver-instructions>> to set up your webserver.
      `
      const expected = heredoc`
      # Title

      Refer to [webserver-instructions](#webserver-instructions) to set up your webserver.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should generate and rewrite ID for discrete heading', () => {
      const input = heredoc`
      = Title
      :idseparator: -

      [discrete]
      == Discrete Heading

      We can refer to a <<_discrete-heading>> using an xref.
      `
      const expected = heredoc`
      # Title

      ## Discrete Heading

      We can refer to a [Discrete Heading](#discrete-heading) using an xref.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should use target as fallback text for external xref', () => {
      const input = heredoc`
      = Title

      Please refer to xref:contributing.adoc[].
      `
      const expected = heredoc`
      # Title

      Please refer to [contributing.adoc](contributing.adoc).
      `
      assert.equal(downdoc(input), expected)
    })

    it('should drop trailing # from target used as fallback text for external xref', () => {
      const input = heredoc`
      = Title

      Please refer to xref:contributing.html#[].
      `
      const expected = heredoc`
      # Title

      Please refer to [contributing.html](contributing.html).
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not prepend # to target of external xref', () => {
      const input = heredoc`
      = Title

      Please refer to the <<contributing.adoc#,contributing guide>>.
      The xref:contribution.adoc[contribution guide] will teach you how to <<contribution.adoc#build-project,build the project>>.
      `
      const expected = heredoc`
      # Title

      Please refer to the [contributing guide](contributing.adoc).
      The [contribution guide](contribution.adoc) will teach you how to [build the project](contribution.adoc#build-project).
      `
      assert.equal(downdoc(input), expected)
    })

    it('should allow space in target of external xref', () => {
      const input = heredoc`
      = Title

      Please refer to the <<how to contribute.adoc#,contributing guide>>.
      The xref:how to contribute.adoc[contribution guide] will teach you how to contribute to the project.
      `
      const expected = heredoc`
      # Title

      Please refer to the [contributing guide](how to contribute.adoc).
      The [contribution guide](how to contribute.adoc) will teach you how to contribute to the project.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should rewrite xref to verbatim block with title and ID', () => {
      const input = heredoc`
      = Title

      See <<ex1>>.

      .Configuration Example
      [#ex1]
      ----
      key: value
      ----
      `
      const expected = heredoc`
      # Title

      See [Configuration Example](#ex1).

      <a name="ex1"></a>**Configuration Example**

      \`\`\`
      key: value
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not rewrite xref with explicit text to verbatim block with title and ID', () => {
      const input = heredoc`
      = Title

      See <<ex1,Example 1>>.

      .Configuration Example
      [#ex1]
      ----
      key: value
      ----
      `
      const expected = heredoc`
      # Title

      See [Example 1](#ex1).

      <a name="ex1"></a>**Configuration Example**

      \`\`\`
      key: value
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should rewrite xref to promoted console block with title and ID', () => {
      const input = heredoc`
      = Title

      To begin, let's <<clone>>.

      .Clone the repository
      [#clone]
       $ git clone https://github.com/opendevise/downdoc
      `
      const expected = heredoc`
      # Title

      To begin, let’s [Clone the repository](#clone).

      <a name="clone"></a>**Clone the repository**

      \`\`\`console
      $ git clone https://github.com/opendevise/downdoc
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should apply subs to title of block in xref', () => {
      const input = heredoc`
      = Title
      :product-name: ACME

      See <<ex1>>.

      .{product-name} _Config_
      [#ex1]
      ----
      key: value
      ----
      `
      const expected = heredoc`
      # Title

      See [ACME _Config_](#ex1).

      <a name="ex1"></a>**ACME _Config_**

      \`\`\`
      key: value
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not match xref macro if macro name delimiter is followed by backtick', () => {
      const input = heredoc`
      xref:\`[]

      An xref macro consists of an \`xref:\` prefix, a target, and \`[]\` with optional link text.
      `
      assert.equal(downdoc(input), input)
    })

    it('should not match xref: prefix followed by colon', () => {
      const input = heredoc`
      = Title

      See <<docname:xref:::link-text>>.

      [[docname:xref:::link-text]][link text] is the part where you specify the text of the link.
      `
      const expected = heredoc`
      # Title

      See [docname:xref:::link-text](#docname:xref:::link-text).

      <a name="docname:xref:::link-text"></a>[link text] is the part where you specify the text of the link.
      `
      assert.equal(downdoc(input), expected)
    })
  })

  describe('link and URL macros', () => {
    it('should convert URL macro', () => {
      const input = heredoc`
      = Title

      These tests are run using https://mochajs.org[Mocha].
      `
      const expected = heredoc`
      # Title

      These tests are run using [Mocha](https://mochajs.org).
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert URL macro defined using attribute reference', () => {
      const input = heredoc`
      = Title
      :url-mocha: https://mochajs.org

      These tests are run using {url-mocha}[Mocha].
      `
      const expected = heredoc`
      # Title

      These tests are run using [Mocha](https://mochajs.org).
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert link macro to relative file', () => {
      const input = heredoc`
      = Title

      The link:[] macro is used to create a link with a non-URL target.

      See link:LICENSE[LICENSE] or link:LICENSE[] to find the license text.
      `
      const expected = heredoc`
      # Title

      The link:[] macro is used to create a link with a non-URL target.

      See [LICENSE](LICENSE) or [LICENSE](LICENSE) to find the license text.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert URL macro with link macro prefix', () => {
      const input = heredoc`
      = Title

      These tests are run using link:https://mochajs.org[Mocha].
      `
      const expected = heredoc`
      # Title

      These tests are run using [Mocha](https://mochajs.org).
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not match link: prefix followed by colon', () => {
      const input = heredoc`
      = Title

      See xref:docname:image-xref-and-link:::[link] to learn more.

      See <<docname:image-xref-and-link:::>> to learn more.

      [#docname:image-xref-and-link:::]
      == Link to Resource from Image
      `
      const expected = heredoc`
      # Title

      See [link](#link-to-resource-from-image) to learn more.

      See [Link to Resource from Image](#link-to-resource-from-image) to learn more.

      ## Link to Resource from Image
      `
      assert.equal(downdoc(input), expected)
    })

    it('should remove open in blank window hint from end of link text', () => {
      const input = heredoc`
      = Title

      These tests are run using https://mochajs.org[Mocha^].
      `
      const expected = heredoc`
      # Title

      These tests are run using [Mocha](https://mochajs.org).
      `
      assert.equal(downdoc(input), expected)
    })

    it('should remove open in blank window hint when used as link text', () => {
      const input = heredoc`
      = Title
      :hide-uri-scheme:

      These tests are run using https://mochajs.org[^].
      `
      const expected = heredoc`
      # Title

      These tests are run using [mochajs.org](https://mochajs.org).
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not modify non-escaped bare URL', () => {
      const input = heredoc`
      Navigate to http://localhost:8080/app to view your application.

      The https://example.org domain name is for tests, tutorials, and examples.
      `
      const expected = heredoc`
      Navigate to http://localhost:8080/app to view your application.

      The https://example.org domain name is for tests, tutorials, and examples.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should obscure escaped bare URL', () => {
      const input = heredoc`
      The site will be running at \\http://localhost:8080/app.

      The \\https://example.org domain name is for tests, tutorials, and examples.
      `
      const expected = heredoc`
      The site will be running at <span>http://</span>localhost:8080/app.

      The <span>https://</span>example.org domain name is for tests, tutorials, and examples.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should obscure escaped URL macro', () => {
      const input = heredoc`
      = Title

      Use \\https://example.org[text] to add a link to text.
      `
      const expected = heredoc`
      # Title

      Use <span>https://</span>example.org[text] to add a link to text.
      `
      assert.equal(downdoc(input), expected)
    })

    // NOTE this does not handle case when URL macro is preceded by link:
    it('should unescape escaped link macro', () => {
      const input = heredoc`
      = Title

      Use \\link:file.ext[text] to link to a relative URL or local file.
      `
      const expected = heredoc`
      # Title

      Use link:file.ext[text] to link to a relative URL or local file.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should hide scheme of URL if hide-uri-scheme attribute is set', () => {
      const input = heredoc`
      :hide-uri-scheme:

      You can usually use https://google.com[] to find what you're looking for.

      The http://example.org domain name is for tests, tutorials, and examples.
      `
      const expected = heredoc`
      You can usually use [google.com](https://google.com) to find what you’re looking for.

      The [example.org](http://example.org) domain name is for tests, tutorials, and examples.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should preserve escaped square brackets in link text', () => {
      const input = heredoc`
      = Title

      The https://example.org[toc::\\[\\]] macro is not supported in Markdown.
      `
      const expected = heredoc`
      # Title

      The [toc::\\[\\]](https://example.org) macro is not supported in Markdown.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should ignore URL and link macros if target contains space', () => {
      const input = heredoc`
      link:not processed.html[]

      https://example.org/not processed.html[]
      `
      assert.equal(downdoc(input), input)
    })

    it('should process xref macro if target has non-leading space', () => {
      const input = heredoc`
      = Title

      xref:is processed.adoc[is processed]

      xref: not processed.adoc[not processed]
      `
      const expected = heredoc`
      # Title

      [is processed](is processed.adoc)

      xref: not processed.adoc[not processed]
      `
      assert.equal(downdoc(input), expected)
    })
  })

  describe('image macros', () => {
    it('should convert local inline image', () => {
      const input = heredoc`
      = Title

      When you see image:images/green-bar.png[green bar], you know the tests have passed!
      `
      const expected = heredoc`
      # Title

      When you see ![green bar](images/green-bar.png), you know the tests have passed!
      `
      assert.equal(downdoc(input), expected)
    })

    it('should generate alt text from basename of target if alt text not specified', () => {
      const input = heredoc`
      = Title

      When you see image:images/red-bar.png[], something has gone wrong.

      Fix the code and click image:run[] to run the test again.

      image::project/3.1/_images/test-result.svg[]
      `
      const expected = heredoc`
      # Title

      When you see ![red-bar](images/red-bar.png), something has gone wrong.

      Fix the code and click ![run](run) to run the test again.

      ![test-result](project/3.1/_images/test-result.svg)
      `
      assert.equal(downdoc(input), expected)
    })

    it('should only use first positional attribute as alt text', () => {
      const input = heredoc`
      = Title

      image::picture.jpg[,600]
      `
      const expected = heredoc`
      # Title

      ![picture](picture.jpg)
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not use named attributes as alt text', () => {
      const input = heredoc`
      = Title

      When you see image:images/red-bar.png[role=red], something has gone wrong.

      image::project/3.1/_images/test-result.svg[opts=interactive]
      `
      const expected = heredoc`
      # Title

      When you see ![red-bar](images/red-bar.png), something has gone wrong.

      ![test-result](project/3.1/_images/test-result.svg)
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert remote inline image', () => {
      const input = heredoc`
      = Title

      * image:https://cdn.jsdelivr.net/gh/madebybowtie/FlagKit/Assets/PNG/FR.png[fr]
      `
      const expected = heredoc`
      # Title

      * ![fr](https://cdn.jsdelivr.net/gh/madebybowtie/FlagKit/Assets/PNG/FR.png)
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert inline image with space in target', () => {
      const input = heredoc`
      = Title

      An image macro consists of an image: prefix, a target, and [] with optional alt text.

      When it works, I get a image:big grin.png[].
      `
      const expected = heredoc`
      # Title

      An image macro consists of an image: prefix, a target, and [] with optional alt text.

      When it works, I get a ![big grin](big grin.png).
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not convert inline image macro if macro name delimiter is followed by backtick', () => {
      const input = heredoc`
      image:\`[]

      An image macro consists of an \`image:\` prefix, a target, and \`[]\` with optional alt text.
      `
      assert.equal(downdoc(input), input)
    })

    it('should prepend value of imagesdir attribute to target of inline image', () => {
      const input = heredoc`
      = Title
      :imagesdir: images

      When you see image:green-bar.png[green bar], you know the tests have passed!

      When you see image:red-bar.png[], something has gone wrong.
      `
      const expected = heredoc`
      # Title

      When you see ![green bar](images/green-bar.png), you know the tests have passed!

      When you see ![red-bar](images/red-bar.png), something has gone wrong.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert local block image', () => {
      const input = heredoc`
      = Title

      Here's a screenshot of the application in action.

      image::images/screenshot.png[]
      `
      const expected = heredoc`
      # Title

      Here’s a screenshot of the application in action.

      ![screenshot](images/screenshot.png)
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert remote block image', () => {
      const input = heredoc`
      = Title

      image::https://cdn.jsdelivr.net/gh/madebybowtie/FlagKit/Assets/PNG/FR.png[fr,32]
      `
      const expected = heredoc`
      # Title

      ![fr](https://cdn.jsdelivr.net/gh/madebybowtie/FlagKit/Assets/PNG/FR.png)
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert block image with space in target', () => {
      const input = heredoc`
      = Title

      image::[not an image macro]

      image:: image.png[not an image macro]

      image::my image.png[my image]
      `
      const expected = heredoc`
      # Title

      image::[not an image macro]

      * **image**\\
      image.png[not an image macro]

      ![my image](my image.png)
      `
      assert.equal(downdoc(input), expected)
    })

    it('should prepend value of imagesdir attribute to target of block image', () => {
      const input = heredoc`
      = Title
      :imagesdir: images

      Here's a screenshot of the application in action.

      image::screenshot.png[]
      `
      const expected = heredoc`
      # Title

      Here’s a screenshot of the application in action.

      ![screenshot](images/screenshot.png)
      `
      assert.equal(downdoc(input), expected)
    })

    it('should substitute attribute reference in target of block image', () => {
      const input = heredoc`
      = Title
      :url-flags: https://cdn.jsdelivr.net/gh/madebybowtie/FlagKit/Assets/PNG

      image::{url-flags}/FR.png[fr]
      `
      const expected = heredoc`
      # Title

      ![fr](https://cdn.jsdelivr.net/gh/madebybowtie/FlagKit/Assets/PNG/FR.png)
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not convert local block image within a paragraph', () => {
      const input = heredoc`
      A block image macro uses the following form:
      image::target[]
      `
      assert.equal(downdoc(input), input)
    })

    it('should preserve escaped square brackets in image alt text', () => {
      const input = heredoc`
      = Title

      image::square-brackets.png[The \\[ and \\] brackets]
      `
      const expected = heredoc`
      # Title

      ![The \\[ and \\] brackets](square-brackets.png)
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not match macro whose target contains backslash characters', () => {
      const input = heredoc`
      = Title

      Learn more about the xref:image-macro[image:\\[\\] macro].

      [#image-macro]
      == Image macro

      Similar to the xref:\\[\\] macro, but for images. The text between [ and ] is the alt text.
      `
      const expected = heredoc`
      # Title

      Learn more about the [image:\\[\\] macro](#image-macro).

      ## Image macro

      Similar to the xref:\\[\\] macro, but for images. The text between [ and ] is the alt text.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should wrap image in link if link attribute is set', () => {
      const input = heredoc`
      = Title

      image::images/screenshot.png[Screenshot,link=https://example.com]

      Click the image:images/green-bar.png[green bar,link=https://ci.example.com] to see the result.
      `
      const expected = heredoc`
      # Title

      [![Screenshot](images/screenshot.png)](https://example.com)

      Click the [![green bar](images/green-bar.png)](https://ci.example.com) to see the result.
      `
      assert.equal(downdoc(input), expected)
    })
  })

  describe('blockquotes', () => {
    it('should retain Markdown-style blockquotes', () => {
      const input = heredoc`
      = Title

      > Roads?
      >
      > Where we're going, we don't need _roads_!

      The rest is...the future!

      > And away we go!
      `
      const expected = heredoc`
      # Title

      > Roads?
      >
      > Where we’re going, we don’t need _roads_!

      The rest is...the future!

      > And away we go!
      `
      assert.equal(downdoc(input), expected)
    })

    it('should unwrap consecutive non-empty lines in Markdown-style blockquote', () => {
      const input = heredoc`
      = Title
      :markdown-unwrap-prose:

      > Where we're going,
      > we don't need _roads_!
      `
      const expected = heredoc`
      # Title

      > Where we’re going, we don’t need _roads_!
      `
      assert.equal(downdoc(input), expected)
    })

    it('should preserve paragraph break when unwrapping Markdown-style blockquote', () => {
      const input = heredoc`
      = Title
      :markdown-unwrap-prose:

      > hi
      >
      > bye
      `
      const expected = heredoc`
      # Title

      > hi
      >
      > bye
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert quote block', () => {
      const input = heredoc`
      = Title

      [,Doc Brown]
      ____
      Roads?

      Where we're going, we don't need _roads_!
      ____

      The rest is...the future!

      ____
      . Fasten seatbelt
      . And away we go!
      ____
      `
      const expected = heredoc`
      # Title

      > Roads?
      >
      > Where we’re going, we don’t need _roads_!
      >
      > — Doc Brown

      The rest is...the future!

      > 1. Fasten seatbelt
      > 2. And away we go!
      `
      assert.equal(downdoc(input), expected)
    })

    it('should preserve indentation of literal paragraph inside quote block', () => {
      const input = heredoc`
      = Title

      ____
      Mind the gap.

       literally
      ____
      `
      const expected = heredoc`
      # Title

      > Mind the gap.
      >
      >     literally
      `
      assert.equal(downdoc(input), expected)
    })

    it('should preserve indentation of empty line in verbatim block inside quote block', () => {
      const input = heredoc`
      = Title

      ____
      ----
      foo

      bar
      ----

      [indent=0]
      ----
       foo

       bar
      ----
      ____
      `
      const expected = heredoc`
      # Title

      > \`\`\`
      > foo
      >
      > bar
      > \`\`\`
      >
      > \`\`\`
      > foo
      >
      > bar
      > \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should indent quote block attached to list item properly', () => {
      const input = heredoc`
      * yin
      +
      ____
      yang
      ____

      * foo
      +
      ____
      bar

      baz
      ____

      fin
      `
      const expected = heredoc`
      * yin

        > yang
      * foo

        > bar
        >
        > baz

      fin
      `
      assert.equal(downdoc(input), expected)
    })

    it('should indent paragraph attached to list inside quote block attached to list', () => {
      const input = heredoc`
      * foo
      +
      ____
      * bar
      +
      baz
      ____
      `
      const expected = heredoc`
      * foo

        > * bar
        >
        >   baz
      `
      assert.equal(downdoc(input), expected)
    })
  })

  describe('code blocks', () => {
    it('should convert literal paragraph', () => {
      const input = heredoc`
      = Title

      beginning

       literal

      middle

          literal
            so literal

      end
      `
      const expected = heredoc`
      # Title

      beginning

          literal

      middle

          literal
            so literal

      end
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert literal paragraph at start of document', () => {
      const input = heredoc`
       literal paragraph

      normal paragraph
      `
      const expected = heredoc`
          literal paragraph

      normal paragraph
      `
      assert.equal(downdoc(input), expected)
    })

    it('should terminate literal paragraph at start of delimited block', () => {
      const input = heredoc`
      = Title

       literal paragraph
      ----
      literal block
      ----
      `
      const expected = heredoc`
      # Title

          literal paragraph
      \`\`\`
      literal block
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should promote literal paragraph that starts with command prompt to a console code block', () => {
      const input = heredoc`
      Example:

       $ npx downdoc README.adoc

      Get more information:

       $ npx downdoc -h
      `
      const expected = heredoc`
      Example:

      \`\`\`console
      $ npx downdoc README.adoc
      \`\`\`

      Get more information:

      \`\`\`console
      $ npx downdoc -h
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not apply subs to literal paragraph by default', () => {
      const input = heredoc`
      = Title
      :foo: bar

       *{foo}*

      fin
      `
      const expected = heredoc`
      # Title

          *{foo}*

      fin
      `
      assert.equal(downdoc(input), expected)
    })

    it('should honor subs attribute on all lines of literal paragraph', () => {
      const input = heredoc`
      :install-prefix: /usr/local

      installing

      [subs=attributes+]
       {install-prefix}/bin/downdoc
       {install-prefix}/lib/downdoc/index.js

      installed
      `
      const expected = heredoc`
      installing

          /usr/local/bin/downdoc
          /usr/local/lib/downdoc/index.js

      installed
      `
      assert.equal(downdoc(input), expected)
    })

    it('should honor subs attribute on all lines of literal paragraph promoted to a console code block', () => {
      const input = heredoc`
      :version-downdoc: 1.0.0

      [subs=attributes+]
       $ npx downdoc@{version-downdoc} -v
       #=> {version-downdoc}
      `
      const expected = heredoc`
      \`\`\`console
      $ npx downdoc@1.0.0 -v
      #=> 1.0.0
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should support title on promoted console literal paragraph', () => {
      const input = heredoc`
      = Document Title

      .Install
       $ npm i downdoc

      All set.
      `
      const expected = heredoc`
      # Document Title

      **Install**

      \`\`\`console
      $ npm i downdoc
      \`\`\`

      All set.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should close implicit console code block at end of document after trimming trailing newline', () => {
      const input = heredoc`
      = Document Title

       $ npx downdoc -h

      ////
      -h and also be written as --help
      ////
      `
      const expected = heredoc`
      # Document Title

      \`\`\`console
      $ npx downdoc -h
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert source block with language', () => {
      const input = heredoc`
      = Title

      [,js]
      ----
      const downdoc = require('downdoc')
      console.log(downdoc('= Document Title'))
      ----
      `
      const expected = heredoc`
      # Title

      \`\`\`js
      const downdoc = require('downdoc')
      console.log(downdoc('= Document Title'))
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert source block with language preceded by space', () => {
      const input = heredoc`
      = Title

      [, text]
      ----
      just plain text
      ----
      `
      const expected = heredoc`
      # Title

      \`\`\`text
      just plain text
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert implicit source block with language and role', () => {
      const input = heredoc`
      [.hide-imports,java]
      ----
      import java.util.*;

      public class Example {
        public static void main (String[] args) {
          System.out.println(Arrays.asList(args));
        }
      }
      ----
      `
      const expected = heredoc`
      \`\`\`java
      import java.util.*;

      public class Example {
        public static void main (String[] args) {
          System.out.println(Arrays.asList(args));
        }
      }
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert explicit source block with language and role', () => {
      const input = heredoc`
      [source.hide-imports,java]
      ----
      import java.util.*;

      public class Example {
        public static void main (String[] args) {
          System.out.println(Arrays.asList(args));
        }
      }
      ----
      `
      const expected = heredoc`
      \`\`\`java
      import java.util.*;

      public class Example {
        public static void main (String[] args) {
          System.out.println(Arrays.asList(args));
        }
      }
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert source block with language and role set on separate lines', () => {
      const input = heredoc`
      [,java]
      [.hide-imports]
      ----
      import java.util.*;

      public class Example {
        public static void main (String[] args) {
          System.out.println(Arrays.asList(args));
        }
      }
      ----
      `
      const expected = heredoc`
      \`\`\`java
      import java.util.*;

      public class Example {
        public static void main (String[] args) {
          System.out.println(Arrays.asList(args));
        }
      }
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert source block with source language set on document', () => {
      const input = heredoc`
      = Title
      :source-language: js

      ----
      const downdoc = require('downdoc')
      console.log(downdoc('= Document Title'))
      ----
      `
      const expected = heredoc`
      # Title

      \`\`\`js
      const downdoc = require('downdoc')
      console.log(downdoc('= Document Title'))
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert source block with attrlist and source language set on document', () => {
      const input = heredoc`
      = Title
      :source-language: js

      [#hello]
      ----
      const downdoc = require('downdoc')
      console.log(downdoc('= Document Title'))
      ----
      `
      const expected = heredoc`
      # Title

      \`\`\`js
      const downdoc = require('downdoc')
      console.log(downdoc('= Document Title'))
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert promoted source block with language', () => {
      const input = heredoc`
      = Title

      [source,js]
      ....
      const downdoc = require('downdoc')
      console.log(downdoc('= Document Title'))
      ....
      `
      const expected = heredoc`
      # Title

      \`\`\`js
      const downdoc = require('downdoc')
      console.log(downdoc('= Document Title'))
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert source block with language with block title above or below block attribute line', () => {
      const input = heredoc`
      = Title

      .Print 1 in JavaScript
      [,js]
      ----
      console.log(1)
      ----

      [,ruby]
      .Print 1 in Ruby
      ----
      puts 1
      ----
      `
      const expected = heredoc`
      # Title

      **Print 1 in JavaScript**

      \`\`\`js
      console.log(1)
      \`\`\`

      **Print 1 in Ruby**

      \`\`\`ruby
      puts 1
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert source block without language', () => {
      const input = heredoc`
      = Title

      [source]
      ----
      /.cache/
      /node_modules/
      ----
      `
      const expected = heredoc`
      # Title

      \`\`\`
      /.cache/
      /node_modules/
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not carry over block attributes from adjacent code block', () => {
      const input = heredoc`
      = Title

      [,ruby]
      ----
      puts 1
      ----
      ----
      puts 1
      ----
      `
      const expected = heredoc`
      # Title

      \`\`\`ruby
      puts 1
      \`\`\`
      \`\`\`
      puts 1
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert listing block', () => {
      const input = heredoc`
      = Title

      ----
      folder/
        file.yml
        subfolder/
          file.js
      ----
      `
      const expected = heredoc`
      # Title

      \`\`\`
      folder/
        file.yml
        subfolder/
          file.js
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert literal block without block style', () => {
      const input = heredoc`
      = Title

      [,tree]
      ....
      folder/
        file.yml
        subfolder/
          file.js
      ....
      `
      const expected = heredoc`
      # Title

      \`\`\`
      folder/
        file.yml
        subfolder/
          file.js
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should ignore language on listing block with listing style', () => {
      const input = heredoc`
      = Title

      [listing,ignored]
      ----
      plain
      verbatim
      ----
      `
      const expected = heredoc`
      # Title

      \`\`\`
      plain
      verbatim
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert literal block with style (diagram)', () => {
      const input = heredoc`
      = Title

      [plantuml]
      ....
      start;
      stop;
      ....
      `
      const expected = heredoc`
      # Title

      \`\`\`plantuml
      start;
      stop;
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not substitute text in a verbatim block without block metadata', () => {
      const input = heredoc`
      = Title
      :project-name: ACME

      The name of the project is {project-name}.

      ----
      {project-name}
      ----

      {project-name} is awesome.
      `
      const expected = heredoc`
      # Title

      The name of the project is ACME.

      \`\`\`
      {project-name}
      \`\`\`

      ACME is awesome.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not substitute text in a verbatim block with block metadata', () => {
      const input = heredoc`
      = Title
      :project-name: ACME

      The name of the project is {project-name}.

      [,ruby]
      ----
      puts '{project-name}'
      ----

      {project-name} is awesome.
      `
      const expected = heredoc`
      # Title

      The name of the project is ACME.

      \`\`\`ruby
      puts '{project-name}'
      \`\`\`

      ACME is awesome.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not process line-oriented syntax inside verbatim block', () => {
      const input = heredoc`
      = Title

      [,asciidoc]
      ----
      = Document Title
      :toc: preamble
      :toc-title: Contents

      preamble

      == Section

      content
      ----

      Isn't AsciiDoc grand?
      `
      const expected = heredoc`
      # Title

      \`\`\`asciidoc
      = Document Title
      :toc: preamble
      :toc-title: Contents

      preamble

      == Section

      content
      \`\`\`

      Isn’t AsciiDoc grand?
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not terminate verbatim block at alternate delimiter line', () => {
      const input = heredoc`
      ----
      above
      ....
      below
      ----
      `
      const expected = heredoc`
      \`\`\`
      above
      ....
      below
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should outdent contents of verbatim block if indent=0 attribute is set', () => {
      const input = heredoc`
      [indent=0]
      ----
        key-1:
          - |
            val

            val
        key-2: ~
      ----

      [indent=0]
      ----
          foo
        bar
      &
      baz
      ----

      [indent=0]
      ----
      \tdef save record
      \t\tthis.db.store(record)
      \tend
      ----

      [indent=0]
      ----
      ----
      `
      const expected = heredoc`
      \`\`\`
      key-1:
        - |
          val

          val
      key-2: ~
      \`\`\`

      \`\`\`
          foo
        bar
      &
      baz
      \`\`\`

      \`\`\`
      def save record
      \tthis.db.store(record)
      end
      \`\`\`

      \`\`\`
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should outdent contents of verbatim block inside quote block if indent=0 attribute is set', () => {
      const input = heredoc`
      ____
      [,java,indent=0]
      ----
        public class Hello {
          public static void main (String... args) {
            System.out.println("Hello, World!");
          }
        }
      ----
      ____
      `
      const expected = heredoc`
      > \`\`\`java
      > public class Hello {
      >   public static void main (String... args) {
      >     System.out.println("Hello, World!");
      >   }
      > }
      > \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should outdent contents of verbatim block inside quote block attached to list item', () => {
      const input = heredoc`
      * list item
      +
      ____
      [,java,indent=0]
      ----
        public class Hello {
          public static void main (String... args) {
            System.out.println("Hello, World!");
          }
        }
      ----
      ____
      `
      const expected = heredoc`
      * list item

        > \`\`\`java
        > public class Hello {
        >   public static void main (String... args) {
        >     System.out.println("Hello, World!");
        >   }
        > }
        > \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should outdent contents of verbatim block attached to list item inside quote block', () => {
      const input = heredoc`
      ____
      * list item
      +
      [,java,indent=0]
      ----
        public class Hello {
          public static void main (String... args) {
            System.out.println("Hello, World!");
          }
        }
      ----
      ____
      `
      const expected = heredoc`
      > * list item
      >
      >   \`\`\`java
      >   public class Hello {
      >     public static void main (String... args) {
      >       System.out.println("Hello, World!");
      >     }
      >   }
      >   \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should honor subs=+attributes on source block', () => {
      const input = heredoc`
      = Title
      :url-repo: https://github.com/octocat/Spoon-Knife

      [,console,subs=+attributes]
      ----
      $ git clone {url-repo}
      ----
      `
      const expected = heredoc`
      # Title

      \`\`\`console
      $ git clone https://github.com/octocat/Spoon-Knife
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should honor subs="attributes+" on source block', () => {
      const input = heredoc`
      = Title
      :url-repo: https://github.com/octocat/Spoon-Knife

      [,console,subs="attributes+"]
      ----
      $ git clone {url-repo}
      ----
      `
      const expected = heredoc`
      # Title

      \`\`\`console
      $ git clone https://github.com/octocat/Spoon-Knife
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not mistake subs attribute for language on listing block', () => {
      const input = heredoc`
      = Title
      :url-repo: https://github.com/octocat/Spoon-Knife

      [,subs="attributes+"]
      ----
      Enter URL: {url-repo}
      ----
      `
      const expected = heredoc`
      # Title

      \`\`\`
      Enter URL: https://github.com/octocat/Spoon-Knife
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should replace conums in source block with circled numbers', () => {
      const input = heredoc`
      = Title

      [,js]
      ----
      'use strict' // <1>

      const fs = require('node:fs') // <2>
      ----
      <1> Enables strict mode.
      <2> Requires the built-in fs module.
      `
      const expected = heredoc`
      # Title

      \`\`\`js
      'use strict' // ①

      const fs = require('node:fs') // ②
      \`\`\`
      1. Enables strict mode.
      2. Requires the built-in fs module.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should replace autonumbered conumms in source block', () => {
      const input = heredoc`
      = Title

      [,js]
      ----
      'use strict' // <.>

      const fs = require('node:fs') // <.>
      ----
      <.> Enables strict mode.
      <.> Requires the built-in fs module.

      [,ruby]
      ----
      # frozen_string_literal: true # <.>

      File.write('bar', 'foo.txt') # <.>
      ----
      <.> Prevents strings from being mutable.
      <.> The File API is part of the stdlib.
      `
      const expected = heredoc`
      # Title

      \`\`\`js
      'use strict' // ①

      const fs = require('node:fs') // ②
      \`\`\`
      1. Enables strict mode.
      2. Requires the built-in fs module.

      \`\`\`ruby
      # frozen_string_literal: true # ①

      File.write('bar', 'foo.txt') # ②
      \`\`\`
      1. Prevents strings from being mutable.
      2. The File API is part of the stdlib.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should support conums up to 10', () => {
      const input = heredoc`
      ----
      ${[...Array(10)].map((_, i) => '<' + (i + 1) + '>').join('\n')}
      ----
      `
      assertx.include(downdoc(input), '⑩')
    })

    it('should support autonumbered conums up to 10', () => {
      const input = heredoc`
      ----
      ${Array(10).fill('<.>').join('\n')}
      ----
      `
      assertx.include(downdoc(input), '⑩')
    })

    it('should replace conum at start of otherwise blank line', () => {
      const input = heredoc`
      ....
      first line
      <1>
      last line
      ....
      <1> blank line
      `
      const expected = heredoc`
      \`\`\`
      first line
      ①
      last line
      \`\`\`
      1. blank line
      `
      assert.equal(downdoc(input), expected)
    })

    it('should substitute all conums on same line in verbatim block', () => {
      const input = heredoc`
      ----
      const Asciidoctor = require('asciidoctor')() <.> <.>

      const doc = Asciidoctor.loadFile('doc.adoc', { safe: 'safe' }) <.> <4>
      ----
      <.> Requires the Asciidoctor.js library.
      <.> Instantiates the Asciidoctor object.
      <.> Parses the AsciiDoc file into a Document object.
      <.> Sets the safe mode from the default of secure to safe.
      `
      const expected = heredoc`
      \`\`\`
      const Asciidoctor = require('asciidoctor')() ① ②

      const doc = Asciidoctor.loadFile('doc.adoc', { safe: 'safe' }) ③ ④
      \`\`\`
      1. Requires the Asciidoctor.js library.
      2. Instantiates the Asciidoctor object.
      3. Parses the AsciiDoc file into a Document object.
      4. Sets the safe mode from the default of secure to safe.
      `
      assert.equal(downdoc(input), expected)
    })
  })

  describe('lists', () => {
    it('should not process list marker within a paragraph', () => {
      const input = heredoc`
      Let the paragraph begin.
      * is the formatting mark for bold.
      - is only a list marker.

      Let another paragraph begin.
      . followed by a space starts an ordered list outside a paragraph.

      One more for the road.
      <1> is a callout list marker and conum.
      `
      assert.equal(downdoc(input), input.replace(/</g, '&lt;'))
    })

    it('should retain unordered list', () => {
      const input = heredoc`
      * work
      * play
      * drink

      paragraph

      * and party!
      `
      assert.equal(downdoc(input), input)
    })

    it('should trim extra spaces following list marker', () => {
      const input = heredoc`
      * ready
      *  set
      *   go!
      `
      const expected = heredoc`
      * ready
      * set
      * go!
      `
      assert.equal(downdoc(input), expected)
    })

    it('should remove blank lines between unordered list items', () => {
      const input = heredoc`
      * work

      ** more work

      * play


      * drink

      and party!
      `
      const expected = heredoc`
      * work
        * more work
      * play
      * drink

      and party!
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert nested unordered lists', () => {
      const input = heredoc`
      * foo
      ** bar
      *** baz
      ** bar
      * foo
      ** bar
      *** baz
      * foo
      `
      const expected = heredoc`
      * foo
        * bar
          * baz
        * bar
      * foo
        * bar
          * baz
      * foo
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert nested unordered lists if they are indented', () => {
      const input = heredoc`
      * foo
       ** bar
        *** baz
       ** bar
      * foo
      `
      const expected = heredoc`
      * foo
        * bar
          * baz
        * bar
      * foo
      `
      assert.equal(downdoc(input), expected)
    })

    it('should honor markdown-list-indent when converting nested unordered lists', () => {
      const input = heredoc`
      * foo
      ** bar
      *** baz
      ** bar
      * foo
      `
      const expected = heredoc`
      * foo
          * bar
              * baz
          * bar
      * foo
      `
      assert.equal(downdoc(input, { attributes: { 'markdown-list-indent': '4' } }), expected)
    })

    it('should not indent empty line in nested list', () => {
      const input = heredoc`
      * foo
      ** bar
      {empty}
      baz
      `
      const expected = heredoc`
      * foo
        * bar

        baz
      `
      assert.equal(downdoc(input), expected)
    })

    it('should unwrap principal text and paragraph on list item when markdown-unwrap-prose attributes is set', () => {
      const input = heredoc`
      :markdown-unwrap-prose:

      * foo
      bar
      +
      fizz
      buzz
      ** bar
      baz
      `
      const expected = heredoc`
      * foo bar

        fizz buzz
        * bar baz
      `
      assert.equal(downdoc(input), expected)
    })

    it('should support single hyphen as unordered list marker', () => {
      const input = heredoc`
      * Do
      - Re
      * Do
      `
      const expected = heredoc`
      * Do
        * Re
      * Do
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not recognize repeating hyphens as list marker', () => {
      const input = heredoc`
      -- foo
      -- bar
      `
      const expected = input
      assert.equal(downdoc(input), expected)
    })

    it('should support block title and ID on list', () => {
      const input = heredoc`
      [#staples]
      .Staples
      * Flour
      * Sugar
      * Oil
      `
      const expected = heredoc`
      <a name="staples"></a>**Staples**

      * Flour
      * Sugar
      * Oil
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert checklist', () => {
      const input = heredoc`
      * [x] done
      * [ ] not done
      * nothing special
      `
      assert.equal(downdoc(input), input)
    })

    it('should convert ordered list to numbered list', () => {
      const input = heredoc`
      = Title

      . one
      . two
      . three
      . _done!_

      paragraph

      . and one
      `
      const expected = heredoc`
      # Title

      1. one
      2. two
      3. three
      4. _done!_

      paragraph

      1. and one
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert ordered list that uses explicit arabic numerals', () => {
      const input = heredoc`
      1. one
      2. two
      3. three
      4. four
      5. five
      6. six
      7. seven
      8. eight
      9. nine
      10. *10!*
      ** out of 10!
      `
      const expected = heredoc`
      1. one
      2. two
      3. three
      4. four
      5. five
      6. six
      7. seven
      8. eight
      9. nine
      10. **10!**
         * out of 10!
      `
      assert.equal(downdoc(input), expected)
    })

    it('should remove blank lines between ordered list items', () => {
      const input = heredoc`
      . one

      .. extra step

      . two


      . three

      done
      `
      const expected = heredoc`
      1. one
         1. extra step
      2. two
      3. three

      done
      `
      assert.equal(downdoc(input), expected)
    })

    it('should break list at block attribute line if preceded by an empty line', () => {
      const input = heredoc`
      . one
      [loweralpha]
      .. nested in one
      . two

      []
      . one
      `
      const expected = heredoc`
      1. one
         1. nested in one
      2. two

      1. one
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert nested ordered lists', () => {
      const input = heredoc`
      . foo
      .. bar
      ... baz
      .. bar
      . foo
      .. bar
      ... baz
      . foo
      `
      const expected = heredoc`
      1. foo
         1. bar
            1. baz
         2. bar
      2. foo
         1. bar
            1. baz
      3. foo
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert nested ordered lists if they are indented', () => {
      const input = heredoc`
      . foo
       .. bar
        ... baz
       .. bar
      . foo
      `
      const expected = heredoc`
      1. foo
         1. bar
            1. baz
         2. bar
      2. foo
      `
      assert.equal(downdoc(input), expected)
    })

    it('should honor markdown-list-indent when converting nested ordered lists', () => {
      const input = heredoc`
      :markdown-list-indent: 4

      . foo
      .. bar
      ... baz
      .. bar
      . foo
      `
      const expected = heredoc`
      1. foo
          1. bar
              1. baz
          2. bar
      2. foo
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert mixed nested lists', () => {
      const input = heredoc`
      * unordered
       .. ordered
        *** unordered
       .. ordered
      * unordered
      `
      const expected = heredoc`
      * unordered
        1. ordered
           * unordered
        2. ordered
      * unordered
      `
      assert.equal(downdoc(input), expected)
    })

    it('should continue numbering from ancestor list', () => {
      const input = heredoc`
      . foo
      .. bar
      ... baz
      . foo
      `
      const expected = heredoc`
      1. foo
         1. bar
            1. baz
      2. foo
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert description list into unordered list with bold first line', () => {
      const input = heredoc`
      term:: desc

      another term::
      desc
      +
      attached paragraph

      yet another term:: desc

      one more term::
      desc
      more desc
      `
      const expected = heredoc`
      * **term**\\
      desc
      * **another term**\\
      desc

        attached paragraph
      * **yet another term**\\
      desc
      * **one more term**\\
      desc
      more desc
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not add hard line break mark to description list term if description resolves to empty', () => {
      const input = heredoc`
      term::

      separator

      term:: {empty}

      term::
      {empty}

      separator

      term::
      `
      const expected = heredoc`
      * **term**

      separator

      * **term**
      * **term**\\

      separator

      * **term**
      `
      assert.equal(downdoc(input), expected)
    })

    it('should allow hard line break mark for dlist term to be configured using markdown-line-break attribute', () => {
      const input = heredoc`
      term:: desc

      another term::
      desc
      `
      const expected = heredoc`
      * **term**<br>
      desc
      * **another term**<br>
      desc
      `
      assert.equal(downdoc(input, { attributes: { 'markdown-line-break': '<br>' } }), expected)
    })

    it('should support block title and ID on description list', () => {
      const input = heredoc`
      [#terms]
      .Glossary
      terroir:: A wine's sense of place.
      complexity:: A wine's characteristic qualities.
      `
      const expected = heredoc`
      <a name="terms"></a>**Glossary**

      * **terroir**\\
      A wine’s sense of place.
      * **complexity**\\
      A wine’s characteristic qualities.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should allow dlist term to start with list marker', () => {
      const input = heredoc`
      -:: subtract
      <:: check if less than
      `
      const expected = heredoc`
      * **-**\\
      subtract
      * **&lt;**\\
      check if less than
      `
      assert.equal(downdoc(input), expected)
    })

    it('should allow repeating colon in description list term', () => {
      const input = heredoc`
      foo::bar:: baz

      ::foo::
      bar

      :::fizz::: buzz
      `
      const expected = heredoc`
      * **foo::bar**\\
      baz
      * **::foo**\\
      bar
        * **:::fizz**\\
        buzz
      `
      assert.equal(downdoc(input), expected)
    })

    // FIXME any repeating colon shouldn't be matched
    it('should not match line with only double colon at start of line as description list entry', () => {
      const input = heredoc`
      ::

      ::foo
      `
      assert.equal(downdoc(input), input)
    })

    it('should convert description list nested in unordered list', () => {
      const input = heredoc`
      * foo
      term:: desc
      * bar
      `
      const expected = heredoc`
      * foo
        * **term**\\
        desc
      * bar
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert description list nested in unordered list and indented', () => {
      const input = heredoc`
      * foo

        term:: desc

      * bar
      `
      const expected = heredoc`
      * foo
        * **term**\\
        desc
      * bar
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert description list nested in ordered list', () => {
      const input = heredoc`
      . foo
      term:: desc
      . bar
      `
      const expected = heredoc`
      1. foo
         * **term**\\
         desc
      2. bar
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert description list nested in ordered list and indented', () => {
      const input = heredoc`
      . foo

        term:: desc

      . bar
      `
      const expected = heredoc`
      1. foo
         * **term**\\
         desc
      2. bar
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert unordered list nested in description list', () => {
      const input = heredoc`
      term::
      * foo
      ** bar
      * baz
      another term::
      `
      const expected = heredoc`
      * **term**
        * foo
          * bar
        * baz
      * **another term**
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert nested description list into unordered list with bold first line', () => {
      const input = heredoc`
      term:: desc

      nested term::: desc

      another nested term:::
      desc

      another term::
      desc
      `
      const expected = heredoc`
      * **term**\\
      desc
        * **nested term**\\
        desc
        * **another nested term**\\
        desc
      * **another term**\\
      desc
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert nested description lists', () => {
      const input = heredoc`
      foo:: bar
      yin::: yang
      fizz:::: buzz
      yin::: yang
      foo:: bar
      yin::: yang
      fizz:::: buzz
      foo::
      bar
      `
      const expected = heredoc`
      * **foo**\\
      bar
        * **yin**\\
        yang
          * **fizz**\\
          buzz
        * **yin**\\
        yang
      * **foo**\\
      bar
        * **yin**\\
        yang
          * **fizz**\\
          buzz
      * **foo**\\
      bar
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not leave behind hard line break marker after description list term followed by separate block', () => {
      const input = heredoc`
      term::
      ----
      listing
      ----
      `
      const expected = heredoc`
      * **term**
      \`\`\`
      listing
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not leave behind hard line break marker after description list entry with attached block', () => {
      const input = heredoc`
      term::
      +
      ----
      listing
      ----
      `
      const expected = heredoc`
      * **term**

        \`\`\`
        listing
        \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert qanda list', () => {
      const input = heredoc`
      [qanda]
      What's the answer to the ultimate question?:: 47

      What's a group of lemurs called?::
      A conspiracy.
      `
      const expected = heredoc`
      1. _What’s the answer to the ultimate question?_\\
      47
      2. _What’s a group of lemurs called?_\\
      A conspiracy.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert nested qanda list', () => {
      const input = heredoc`
      [qanda]
      Did you read the novel?::
      [qanda]
      Who is the main character?:::
      Jon

      What is the main character's personal conflict?:::
      Lack of respect from parents.
      `
      const expected = heredoc`
      1. _Did you read the novel?_
         1. _Who is the main character?_\\
         Jon
         2. _What is the main character’s personal conflict?_\\
         Lack of respect from parents.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should continue numbering after list item with attached block followed by blank line', () => {
      const input = heredoc`
      . one

       literal paragraph
      +
      paragraph

      . two
      +
       literal paragraph

      paragraph
      `
      const expected = heredoc`
      1. one

             literal paragraph

         paragraph
      2. two

             literal paragraph

      paragraph
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not process section title inside list item', () => {
      const input = heredoc`
      * first list item
      == not a section title
      ** nested list item
      * last list item
      `
      const expected = heredoc`
      * first list item
      == not a section title
        * nested list item
      * last list item
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert colist to numbered list', () => {
      const input = heredoc`
      = Document Title

      <1> Prints the number 1.
      <2> Exits the program.
      <3> Explain me.
      <4> Explain me.
      <5> Explain me.
      <6> Explain me.
      <7> Explain me.
      <8> Explain me.
      <9> Explain me.
      <10> Explain me.
      `
      const expected = heredoc`
      # Document Title

      1. Prints the number 1.
      2. Exits the program.
      3. Explain me.
      4. Explain me.
      5. Explain me.
      6. Explain me.
      7. Explain me.
      8. Explain me.
      9. Explain me.
      10. Explain me.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should convert colist with autonumbering to numbered list', () => {
      const input = heredoc`
      = Document Title

      <.> Prints the number 1.
      <.> Exits the program.
      `
      const expected = heredoc`
      # Document Title

      1. Prints the number 1.
      2. Exits the program.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should indent block following a list continuation', () => {
      const input = heredoc`
      * Install
      +
      [,console]
      ----
      $ npm i downdoc
      ----

      * Use
      +
      [,console]
      ----
      $ npx downdoc README.adoc
      ----
      `
      const expected = heredoc`
      * Install

        \`\`\`console
        $ npm i downdoc
        \`\`\`
      * Use

        \`\`\`console
        $ npx downdoc README.adoc
        \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should indent block following a list continuation on description list item', () => {
      const input = heredoc`
      Install::
      +
      [,console]
      ----
      $ npm i downdoc
      ----

      Use::
      +
      [,console]
      ----
      $ npx downdoc README.adoc
      ----
      `
      const expected = heredoc`
      * **Install**

        \`\`\`console
        $ npm i downdoc
        \`\`\`
      * **Use**

        \`\`\`console
        $ npx downdoc README.adoc
        \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should indent block following a list continuation on colist item', () => {
      const input = heredoc`
      = Document Title

      <.> Prints the number 1.
      <.> Exits the program.
      +
      This happens automatically when all statements have been exhausted.
      `
      const expected = heredoc`
      # Document Title

      1. Prints the number 1.
      2. Exits the program.

         This happens automatically when all statements have been exhausted.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should indent block following a list continuation of nested list item', () => {
      const input = heredoc`
      * Install
      ** npx
      +
       $ npx downdoc -v
      * Use
      +
       $ npx downdoc README.adoc
      `
      const expected = heredoc`
      * Install
        * npx

          \`\`\`console
          $ npx downdoc -v
          \`\`\`
      * Use

        \`\`\`console
        $ npx downdoc README.adoc
        \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should interpret literal paragraph in list as having an implicit list continuation', () => {
      const input = heredoc`
      * Query the version of the app that is installed:

       $ app -v

      * Look for the following output:

       v1.0.0
       [node: v16]

      * Now you are ready to go.
      `
      const expected = heredoc`
      * Query the version of the app that is installed:

        \`\`\`console
        $ app -v
        \`\`\`
      * Look for the following output:

            v1.0.0
            [node: v16]
      * Now you are ready to go.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should restore indent after literal paragraph attached to block attached to list item', () => {
      const input = heredoc`
      * top-level list
      ** nested list

       attached literal paragraph
      +
      attached paragraph

       attached literal paragraph
      +
      attached paragraph

      after list
      `
      const expected = heredoc`
      * top-level list
        * nested list

              attached literal paragraph

          attached paragraph

              attached literal paragraph

          attached paragraph

      after list
      `
      assert.equal(downdoc(input), expected)
    })

    it('should close promoted console code block at list continuation', () => {
      const input = heredoc`
      :foo: bar

      * li
      +
      para

       $ cmd
      +
      para
       {foo}

      after list
      `
      const expected = heredoc`
      * li

        para

        \`\`\`console
        $ cmd
        \`\`\`

        para
         bar

      after list
      `
      assert.equal(downdoc(input), expected)
    })

    it('should retain blockquote indent on list continuation line', () => {
      const input = heredoc`
      ____
      * foo
      +
      bar
      ____
      `
      const expected = heredoc`
      > * foo
      >
      >   bar
      `
      assert.equal(downdoc(input), expected)
    })

    it('should create isolated list context inside block attached to a list', () => {
      const input = heredoc`
      * outside
      +
      --
      * inside
      +
      more
      --
      * outside
      `
      const expected = heredoc`
      * outside

        * inside

          more
      * outside
      `
      assert.equal(downdoc(input), expected)
    })

    it('should end list when followed by non-adjacent delimited block', () => {
      const input = heredoc`
      . list item
      ** list item

      ----
      verbatim stuff
      ----
      . list item
      `
      const expected = heredoc`
      1. list item
         * list item

      \`\`\`
      verbatim stuff
      \`\`\`
      1. list item
      `
      assert.equal(downdoc(input), expected)
    })

    it('should end list when followed by adjacent delimited block', () => {
      const input = heredoc`
      . list item
      ** list item
      ----
      verbatim stuff
      ----
      . list item
      `
      const expected = heredoc`
      1. list item
         * list item
      \`\`\`
      verbatim stuff
      \`\`\`
      1. list item
      `
      assert.equal(downdoc(input), expected)
    })

    it('should end list if literal paragraph in list item has block attributes', () => {
      const input = heredoc`
      * Query the version of the app that is installed:

       $ app -v

      * Look for the following output:

      [.output]
       v1.0.0

      Now you are ready to go.
      `
      const expected = heredoc`
      * Query the version of the app that is installed:

        \`\`\`console
        $ app -v
        \`\`\`
      * Look for the following output:

          v1.0.0

      Now you are ready to go.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should interpret block title following list continuation', () => {
      const input = heredoc`
      * Say hello
      +
      .With Ruby
      [,ruby]
      ----
      puts 'Hello!'
      ----
      +
      .With JavaScript
      [,js]
      ----
      console.log('Hello!')
      ----
      `
      const expected = heredoc`
      * Say hello

        **With Ruby**

        \`\`\`ruby
        puts 'Hello!'
        \`\`\`

        **With JavaScript**

        \`\`\`js
        console.log('Hello!')
        \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should apply correct indentation to literal paragraph in list', () => {
      const input = heredoc`
      * Option to print version:
      +
       -v
      * Option to see help:
      +
       -h
      `
      const expected = heredoc`
      * Option to print version:

            -v
      * Option to see help:

            -h
      `
      assert.equal(downdoc(input), expected)
    })

    it('should close implicit console listing before starting next list item', () => {
      const input = heredoc`
      :foo: bar

      . Run this:
      +
       $ cmd
      . Follow the instructions in the console.
       {foo}
      `
      const expected = heredoc`
      1. Run this:

         \`\`\`console
         $ cmd
         \`\`\`
      2. Follow the instructions in the console.
       bar
      `
      assert.equal(downdoc(input), expected)
    })

    it('should indent verbatim blocks in list item', () => {
      const input = heredoc`
      * run this:
      +
       $ command
      * look for this:
      +
       output
      * enter this:
      +
      .code
      ----
      listing

      another line
      ----

      all done
      `
      const expected = heredoc`
      * run this:

        \`\`\`console
        $ command
        \`\`\`
      * look for this:

            output
      * enter this:

        **code**

        \`\`\`
        listing

        another line
        \`\`\`

      all done
      `
      assert.equal(downdoc(input), expected)
    })

    it('should continue list item throughout attached container', () => {
      const input = heredoc`
      * list item
      +
      --
      attached

      keep it going

      not done yet
      --

      done now
      `
      const expected = heredoc`
      * list item

        attached

        keep it going

        not done yet

      done now
      `
      assert.equal(downdoc(input), expected)
    })

    it('should restore indent after literal paragraph inside block attached to list item', () => {
      const input = heredoc`
      * list item
      +
      --
      attached

       literal paragraph

      still attached
      --

      not attached
      `
      const expected = heredoc`
      * list item

        attached

            literal paragraph

        still attached

      not attached
      `
      assert.equal(downdoc(input), expected)
    })

    it('should continue list item throughout attached container with nested container', () => {
      const input = heredoc`
      * list item
      +
      --
      attached

      ====
      keep it going

      still going
      ====

      not done yet
      --

      done now
      `
      const expected = heredoc`
      * list item

        attached

        keep it going

        still going

        not done yet

      done now
      `
      assert.equal(downdoc(input), expected)
    })

    it('should continue list item throughout attached container with nested verbatim block', () => {
      const input = heredoc`
      * list item
      +
      --
      attached

      ....
      keep it going

      still going
      ....

      not done yet
      --

      done now
      `
      const expected = heredoc`
      * list item

        attached

        \`\`\`
        keep it going

        still going
        \`\`\`

        not done yet

      done now
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not process list continuation outside of list', () => {
      const input = heredoc`
      +
      paragraph
      `
      assert.equal(downdoc(input), input)
    })

    it('should reset indent when starting new ordered list item', () => {
      const input = heredoc`
      . Install
      +
      [,console]
      ----
      $ npm i downdoc
      ----
      . Use
      +
      [,console]
      ----
      $ npx downdoc README.adoc
      ----
      `
      const expected = heredoc`
      1. Install

         \`\`\`console
         $ npm i downdoc
         \`\`\`
      2. Use

         \`\`\`console
         $ npx downdoc README.adoc
         \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })
  })

  describe('comments', () => {
    it('should skip line comments', () => {
      const input = heredoc`
      // This is an AsciiDoc document.
      = Title
      // This line defines an attribute.
      :summary: Summary
      // This line is simply ignored.

      // This outputs the value of the summary attribute.
      {summary}

      // This is just a regular paragraph.
      More summary
      //fin
      `
      const expected = heredoc`
      # Title

      Summary

      More summary
      `
      assert.equal(downdoc(input), expected)
    })

    it('should skip line comment that contains a dlist term', () => {
      const input = heredoc`
      //old term:: description
      new term:: description
      `
      const expected = heredoc`
      * **new term**\\
      description
      `
      assert.equal(downdoc(input), expected)
    })

    // NOTE: it's an open question about whether a block comment breaks a paragraph
    it('should skip block comments', () => {
      const input = heredoc`
      ////
      Maybe a license header?

      Any amount of lines are skipped.
      ////
      = Title
      :summary: Summary

      ////
      - ignore
      - these
      - lines

      these are just notes
      ////

      {summary}

      More summary
      ////
      Maybe some instructions to the author here?
      ////
      . Wrap it up!
      `
      const expected = heredoc`
      # Title

      Summary

      More summary
      1. Wrap it up!
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not stop skipping block comment that contains other skipping line', () => {
      const input = heredoc`
      before

      ////
      comment

      |===

      still comment

      endif::[]

      still comment
      ////

      after
      `
      const expected = heredoc`
      before

      after
      `
      assert.equal(downdoc(input), expected)
    })
  })

  describe('preprocessor conditionals', () => {
    it('should expand ifdef enclosure on attribute entry in header for defined attribute', () => {
      const input = heredoc`
      = Title
      :project-handle: downdoc
      ifdef::project-handle[:url-project: https://example.org/{project-handle}]

      This project is named {project-handle}.
      The URL of the project is {url-project}.
      `
      const expected = heredoc`
      # Title

      This project is named downdoc.
      The URL of the project is https://example.org/downdoc.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should permit use of conditional directive above doctitle', () => {
      const input = heredoc`
      ifdef::not-set[ignore line]
      = Title
      :project-handle: downdoc

      This project is named {project-handle}.
      `
      const expected = heredoc`
      # Title

      This project is named downdoc.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should skip ifdef enclosure on attribute entry in header for undefined attribute', () => {
      const input = heredoc`
      = Title
      ifdef::env-github[:toc-title: Contents]

      {toc-title}
      `
      const expected = heredoc`
      # Title

      {toc-title}
      `
      assert.equal(downdoc(input), expected)
    })

    it('should expand ifndef enclosure on attribute entry in header for undefined attribute', () => {
      const input = heredoc`
      = Title
      ifndef::project-handle[:project-handle: downdoc]
      :url-project: https://example.org/{project-handle}

      This project is named {project-handle}.
      The URL of the project is {url-project}.
      `
      const expected = heredoc`
      # Title

      This project is named downdoc.
      The URL of the project is https://example.org/downdoc.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should skip ifndef enclosure on attribute entry in header for defined attribute', () => {
      const input = heredoc`
      = Title
      :project-handle: downdoc
      ifndef::project-handle[:project-handle: foobar]
      :url-project: https://example.org/{project-handle}

      This project is named {project-handle}.
      The URL of the project is {url-project}.
      `
      const expected = heredoc`
      # Title

      This project is named downdoc.
      The URL of the project is https://example.org/downdoc.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should keep contents of ifdef directive block if attribute is set', () => {
      const input = heredoc`
      = Title
      :badges:

      ifdef::badges[]
      image:https://img.shields.io/npm/v/downdoc[npm version]
      endif::[]

      Summary
      `
      const expected = heredoc`
      # Title

      ![npm version](https://img.shields.io/npm/v/downdoc)

      Summary
      `
      assert.equal(downdoc(input), expected)
    })

    it('should keep contents of ifndef directive block if attribute is not set', () => {
      const input = heredoc`
      = Title

      ifndef::author[]
      There is no author.
      endif::[]

      Summary
      `
      const expected = heredoc`
      # Title

      There is no author.

      Summary
      `
      assert.equal(downdoc(input), expected)
    })

    it('should skip ifdef directive block if attribute is not set and collapse empty lines', () => {
      const input = heredoc`
      = Title

      ifdef::not-set[]
      image:https://img.shields.io/npm/v/downdoc[link="https://www.npmjs.com/package/downdoc",title="npm version"]
      endif::[]

      Summary
      `
      const expected = heredoc`
      # Title

      Summary
      `
      assert.equal(downdoc(input), expected)
    })

    it('should skip ifndef directive block if attribute is set and collapse empty lines', () => {
      const input = heredoc`
      = Title
      Author Name
      ifdef::author[:attribution: written by {author}]
      Ignored.

      ifndef::author[]
      There is no author.
      endif::[]

      Summary {attribution}.
      `
      const expected = heredoc`
      # Title

      Summary written by Author Name.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not stop skipping ifdef enclosure if it contains another skipping line', () => {
      const input = heredoc`
      = Title

      ifdef::not-set[]
      skipped

      ////

      also skipped
      endif::[]

      Summary
      `
      const expected = heredoc`
      # Title

      Summary
      `
      assert.equal(downdoc(input), expected)
    })

    it('should skip single-line conditional directive if condition is false', () => {
      const input = heredoc`
      = Title

      ifdef::flag[ignored line]
      Summary
      `
      const expected = heredoc`
      # Title

      Summary
      `
      assert.equal(downdoc(input), expected)
    })

    it('should keep and process text from single-line conditional directive if condition is true', () => {
      const input = heredoc`
      = Title
      :foo: bar

      ifndef::bar[{foo}]
      `
      const expected = heredoc`
      # Title

      bar
      `
      assert.equal(downdoc(input), expected)
    })

    it('should allow single-line conditional directive to enclose block macro', () => {
      const input = heredoc`
      = Title
      :imagesdir: img

      ifdef::imagesdir[image::screenshot.png[Screenshot]]
      `
      const expected = heredoc`
      # Title

      ![Screenshot](img/screenshot.png)
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not remove unmatched endif::[] directive', () => {
      const input = heredoc`
      before
      endif::[]
      after
      `
      assert.equal(downdoc(input), input)
    })

    it('should not remove unmatched endif::[] directive following single-line conditional directive', () => {
      const input = heredoc`
      ifndef::not-set[before]
      endif::[]
      after
      `
      const expected = heredoc`
      before
      endif::[]
      after
      `
      assert.equal(downdoc(input), expected)
    })

    it('should support nested preprocessor conditionals that evaluate to true', () => {
      const input = heredoc`
      = Title
      :foo: bar

      ifdef::foo[]
      foo is set
      ifndef::yin[]
      yin is not set
      endif::[]
      ifdef::foo[foo is still set]
      endif::[]
      fin
      `
      const expected = heredoc`
      # Title

      foo is set
      yin is not set
      foo is still set
      fin
      `
      assert.equal(downdoc(input), expected)
    })

    it('should support nested preprocessor conditionals that evaluate to false', () => {
      const input = heredoc`
      = Title
      :foo: bar

      ifndef::foo[]
      foo is not set
      ifdef::yin[]
      yin is set
      endif::[]
      foo is still not set
      endif::[]
      fin
      `
      const expected = heredoc`
      # Title

      fin
      `
      assert.equal(downdoc(input), expected)
    })

    it('should support preprocessor conditional that evaluates to false inside one that evaluates to true', () => {
      const input = heredoc`
      = Title
      :foo: bar
      :yin: yang

      ifdef::foo[]
      foo is set
      ifndef::yin[]
      yin is not set
      endif::[]
      foo is still set
      endif::[]
      fin
      `
      const expected = heredoc`
      # Title

      foo is set
      foo is still set
      fin
      `
      assert.equal(downdoc(input), expected)
    })

    it('should support preprocessor conditional that evaluates to true inside one that evaluates to false', () => {
      const input = heredoc`
      = Title
      :yin: yang

      ifdef::foo[]
      foo is set
      ifdef::yin[]
      yin is set
      endif::[]
      foo is still set
      endif::[]
      fin
      `
      const expected = heredoc`
      # Title

      fin
      `
      assert.equal(downdoc(input), expected)
    })

    it('should support block comment inside preprocessor conditional that resolves to true', () => {
      const input = heredoc`
      = Title
      :foo: bar

      ifdef::foo[]
      foo is set
      ////
      comment
      ////
      endif::[]
      fin
      `
      const expected = heredoc`
      # Title

      foo is set
      fin
      `
      assert.equal(downdoc(input), expected)
    })

    it('should unescape escaped preprocessor directive in verbatim block', () => {
      const input = heredoc`
      ----
      \\image::banner.png[]

      \\ifndef::show-notice[]
      \\include::notice.adoc[]
      \\endif::[]
      ----
      `
      const expected = heredoc`
      \`\`\`
      \\image::banner.png[]

      ifndef::show-notice[]
      include::notice.adoc[]
      endif::[]
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should unescape escaped preprocessor directive outside verbatim block', () => {
      const input = heredoc`
      \\ifndef::show-notice[]
      \\include::notice.adoc[]
      \\endif::[]
      `
      const expected = heredoc`
      ifndef::show-notice[]
      include::notice.adoc[]
      endif::[]
      `
      assert.equal(downdoc(input), expected)
    })

    it('should process preprocessor conditionals inside verbatim block', () => {
      const input = heredoc`
      :foo: bar

      ----
      ifdef::foo[]
      foo is set
      endif::[]
      include::ignored.adoc[]
      ----
      `
      const expected = heredoc`
      \`\`\`
      foo is set
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })
  })

  describe('output', () => {
    it('should trim trailing blank line', () => {
      const input = heredoc`
      = Document Title

      Content.

      ////
      Comments about this document.
      ////
      `
      const expected = heredoc`
      # Document Title

      Content.
      `
      assert.equal(downdoc(input), expected)
    })

    it('should trim trailing space', () => {
      const input = heredoc`
      first paragraph

      second paragraph
      `
      assert.equal(downdoc(input + '\n  '), input)
    })

    it('should trim leading blank lines', () => {
      const input = heredoc`
      // Note to self

      ifdef::not-set:[]
      Draft content.
      endif::[]
      Visible content.
      `
      const expected = 'Visible content.'
      assert.equal(downdoc(input), expected)
    })

    it('should trim leading blank lines after applying subs', () => {
      const input = heredoc`
      {empty}
      Visible content.
      `
      const expected = 'Visible content.'
      assert.equal(downdoc(input), expected)
    })
  })

  describe('unsupported', () => {
    it('should drop toc macro', () => {
      const input = heredoc`
      = Title

      toc::[]

      == First Section
      `
      const expected = heredoc`
      # Title

      ## First Section
      `
      assert.equal(downdoc(input), expected)
    })

    it('should drop page break', () => {
      const input = heredoc`
      first page

      <<<

      second page
      `
      const expected = heredoc`
      first page

      second page
      `
      assert.equal(downdoc(input), expected)
    })

    it('should drop include directive', () => {
      const input = heredoc`
      = Title

      == Chapter A

      include::chapter-b[]

      == Chapter C
      `
      const expected = heredoc`
      # Title

      ## Chapter A

      ## Chapter C
      `
      assert.equal(downdoc(input), expected)
    })

    it('should ignore ID on block without title', () => {
      const input = heredoc`
      See <<fizz>>.

      [#fizz]
      ----
      buzz
      ----
      `
      const expected = heredoc`
      See [fizz](#fizz).

      \`\`\`
      buzz
      \`\`\`
      `
      assert.equal(downdoc(input), expected)
    })

    it('should ignore cell specifier on table cells', () => {
      const input = heredoc`
      |===
      |A |B |C

      s| strong >m| monospace ^.<| normal
      |===
      `
      const expected = heredoc`
      | A | B | C |
      | --- | --- | --- |
      | strong | monospace | normal |
      `
      assert.equal(downdoc(input), expected)
    })

    it('should not process non-paragraph blocks in Markdown-style blockquote', () => {
      const input = heredoc`
      > . one
      > . two
      > . three

      > NOTE: This is treated as a regular paragraph.

      > ====
      > example
      > ====
      `
      assert.equal(downdoc(input), input)
    })
  })
})
