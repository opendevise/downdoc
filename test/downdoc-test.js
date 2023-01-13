/* eslint-env mocha */
'use strict'

const { expect, heredoc } = require('./harness')
const downdoc = require('downdoc')

describe('downdoc()', () => {
  describe('document parts', () => {
    it('should convert empty document', () => {
      const input = ''
      expect(downdoc(input)).to.equal(input)
    })

    it('should convert document with only body', () => {
      const input = 'Body.'
      expect(downdoc(input)).to.equal(input)
    })

    it('should convert document with only document title', () => {
      const input = '= Title'
      const expected = '# Title'
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should discard author line with single author', () => {
      const input = heredoc`
      = Title
      Doc Writer <doc@example.org>

      Body written by {author}.
      `
      const expected = heredoc`
      # Title

      Body written by Doc Writer.
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should discard author line with multiple authors', () => {
      const input = heredoc`
      = Title
      Doc Writer <doc@example.org>; Junior Écrivain <jr@example.org>

      Body written by {authors}.
      `
      const expected = heredoc`
      # Title

      Body written by Doc Writer, Junior Écrivain.
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should discard revision line with only version', () => {
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should discard revision line with only date', () => {
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should discard revision line with version and date', () => {
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should discard line after author line if only contains single number', () => {
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should process and remove attribute entries found in document header above doctitle', () => {
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should process attribute entries found in body', () => {
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should set value of attribute entry to empty string if value is not specified', () => {
      const input = heredoc`
      = Title
      :empty:

      foo{empty}bar
      `
      const expected = heredoc`
      # Title

      foobar
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input, { attributes: { 'attribute-from-api': 'from API' } })).to.equal(expected)
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
      expect(downdoc(input, { attributes: { doctitle: 'Title' } })).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should permit all unicode letter characters in referenced attribute name', () => {
      const input = heredoc`
      = Le Titre
      :dépôt-git: opendevise/downdoc

      Vous pouvez aussi récupérer les sources via le dépôt Git à {dépôt-git}.
      `
      const expected = heredoc`
      # Le Titre

      Vous pouvez aussi récupérer les sources via le dépôt Git à opendevise/downdoc.
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should substitute multiple attribute references in same line', () => {
      const input = heredoc`
      = Title
      :author-1: Jim
      :author-2: Jane

      This project was created by {author-1} and {author-2}.
      `
      const expected = heredoc`
      # Title

      This project was created by Jim and Jane.
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(input).to.include('\\')
      expect(downdoc(input)).to.equal(expected)
    })

    it('should unescape escaped attribute references in normal phrase', () => {
      const input = heredoc`
      = Title

      Replace the token \\{owner} with the username or organization and replace the token \\{repo} with the name of the repository.
      `
      const expected = heredoc`
      # Title

      Replace the token {owner} with the username or organization and replace the token {repo} with the name of the repository.
      `
      expect(input).to.include('\\')
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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

      content

      == Another Level 1
      `
      const expected = heredoc`
      # Title

      ## Level 1

      content

      ### Level 2

      #### Level 3

      content

      ## Another Level 1
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should convert part title when document has no title', () => {
      const input = heredoc`
      :doctype: book
      Not an author line.

      = First Steps

      == Installation
      `
      const expected = heredoc`
      Not an author line.

      # First Steps

      ## Installation
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should convert line with heading marker only as paragraph text', () => {
      const input = '=='
      const expected = input
      expect(downdoc(input)).to.equal(expected)
    })

    it('should convert line with heading marker followed by multiple spaces as paragraph text', () => {
      const input = '==  Not a Heading'
      const expected = input
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })
  })

  describe('block titles', () => {
    it('should convert block title above block', () => {
      const input = heredoc`
      .Usage
       downdoc [OPTION]... FILE
      `
      const expected = heredoc`
      **Usage**

          downdoc [OPTION]... FILE
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should convert block title on each block', () => {
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should not output dangling block title', () => {
      const input = heredoc`
      last paragraph

      .dangling block title
      `
      const expected = 'last paragraph'
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should not process . on a line by itself as a block title', () => {
      const input = heredoc`
      before

      .

      after
      `
      expect(downdoc(input)).to.equal(input)
    })

    it('should process paragraph that begins with ellipsis normally', () => {
      const input = heredoc`
      ...and to *home*
      we shall go!
      `
      const expected = heredoc`
      ...and to **home**
      we shall go!
      `
      expect(downdoc(input)).to.equal(expected)
    })
  })

  describe('paragraphs', () => {
    it('should not process section title within a paragraph', () => {
      const input = heredoc`
      Let the paragraph begin.
      == only starts a section title outside of a paragraph.
      `
      expect(downdoc(input)).to.equal(input)
    })

    it('should not process attribute entry within a paragraph', () => {
      const input = heredoc`
      Let the paragraph begin.
      :name: declares an attibute in the document header.
      `
      expect(downdoc(input)).to.equal(input)
    })

    it('should not process block title within a paragraph', () => {
      const input = heredoc`
      Let the paragraph begin.
      .hidden.adoc is a hidden file.
      `
      expect(downdoc(input)).to.equal(input)
    })

    it('should not process indented line within a paragraph', () => {
      const input = heredoc`
      Let the paragraph begin.
        This paragraph uses a hanging indent.
      `
      expect(downdoc(input)).to.equal(input)
    })

    it('should not replace admonition label within a paragraph', () => {
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should not process toc::[] macro within a paragraph', () => {
      const input = heredoc`
      Let the paragraph begin.
      When you see this line outside a paragraph:
      toc::[]
      it will be replaced with the table of contents.
      `
      expect(downdoc(input)).to.equal(input)
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

      **📌 NOTE** Remember the oat milk.

      **❗ IMPORTANT** Don’t forget the children!

      **💡 TIP** Look for the [warp](https://en.wikipedia.org/wiki/Warp_(video_games)) under the bridge.

      **🔥 CAUTION** Slippery when wet.

      **⚠️ WARNING** The software you’re about to use has **not** been tested.
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should end literal paragraph at next block attribute line', () => {
      const input = heredoc`
       literal
       paragraph
      []
      paragraph
      `
      const expected = heredoc`
          literal
          paragraph
      paragraph
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should convert hard line break on line by itself', () => {
      const input = heredoc`
      foo
       +
      bar
      `
      const expected = heredoc`
      foo
      \\
      bar
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should not look for hardbreak if previous line is empty', () => {
      const input = heredoc`
      foo

      {empty}
      bar
      `
      const expected = heredoc`
      foo


      bar
      `
      expect(downdoc(input, { attributes: { empty: '' } })).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should unwrap verbatim block enclosed in example block', () => {
      const input = heredoc`
      = Title

      .Ignored
      ====
      ....
      verbatim content
      ....
      ====

      == Following Section

      content
      `
      const expected = heredoc`
      # Title

      \`\`\`
      verbatim content
      \`\`\`

      ## Following Section

      content
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should convert collapsible block to spoiler variant if markdown-collapsible-variant is spoiler', () => {
      const input = heredoc`
      = Title

      .Always visible text
      [%collapsible]
      ====
      This text won't be visible until the user clicks the always visible text.

      TIP: Click the *always visible text* to hide this text again.
      ====
      `
      const expected = heredoc`
      # Title

      \`\`\`spoiler Always visible text
      This text won’t be visible until the user clicks the always visible text.

      **💡 TIP** Click the **always visible text** to hide this text again.
      \`\`\`
      `
      expect(downdoc(input, { attributes: { 'markdown-collapsible-variant': 'spoiler' } })).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })
  })

  describe('tables', () => {
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should convert table with jagged rows', () => {
      const input = heredoc`
      |===
      | Col A | Col B | Col C

      | A1 | B1
      | C1 | A2 | B2
      | C2
      |===
      `
      const expected = heredoc`
      | Col A | Col B | Col C |
      | --- | --- | --- |
      | A1 | B1 | C1 |
      | A2 | B2 | C2 |
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should normalize space around cell text', () => {
      const input = heredoc`
      |===
      |Col A |  Col B

      |A1    |  B1

      |   A2 |     B2
      |===
      `
      const expected = heredoc`
      | Col A | Col B |
      | --- | --- |
      | A1 | B1 |
      | A2 | B2 |
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should create empty header row if first row has less columns than specified', () => {
      const input = heredoc`
      [cols=3*]
      |===
      |A1
      |B1
      |C1
      |A2
      |B2
      |C2
      |===
      `
      const expected = heredoc`
      |     |     |     |
      | --- | --- | --- |
      | A1 | B1 | C1 |
      | A2 | B2 | C2 |
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should use first row to determine number of columns without creating header', () => {
      const input = heredoc`
      |===
      |A
      |===
      `
      const expected = heredoc`
      |     |
      | --- |
      | A |
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should leave escaped bold formatting escaped', () => {
      const input = heredoc`
      Use the syntax \\*phrase here* to render text in bold.

      \\*a becomes b*
      `
      const expected = input
      expect(downdoc(input)).to.equal(expected)
    })

    it('should convert bold formatting in unordered list item', () => {
      const input = '* be *bold*'
      const expected = '* be **bold**'
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should leave escaped italic formatting escaped', () => {
      const input = heredoc`
      Use the syntax \\_phrase here_ to render text in italic.

      \\_layouts or layouts_ contain the layout files.
      `
      const expected = input
      expect(downdoc(input)).to.equal(expected)
    })

    it('should convert bold italic formatting in either order', () => {
      const input = heredoc`
      = Title

      If you really want to be some *_emphasis_* on it, use _*bold italic*_.
      `
      const expected = heredoc`
      # Title

      If you really want to be some **_emphasis_** on it, use _**bold italic**_.
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should convert monospace formatting', () => {
      const input = heredoc`
      = Title

      A boolean value can be \`true\` or \`false\`.
      `
      const expected = heredoc`
      # Title

      A boolean value can be \`true\` or \`false\`.
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should not escape < inside monospace phrase', () => {
      const input = heredoc`
      The name of an XML tag is enclosed in \`<\` and \`>\` characters, such as \`<root>\`.

      An inline macro follows the format \`<name>:<target>[<attrlist>]\`.
      `
      expect(downdoc(input)).to.equal(input)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should remove backslashes in monospace phrase', () => {
      const input = heredoc`
      = Title

      Visit \`\\http://localhost:8080\` or \`\\http://127.0.0.1:8080\` in your browser to see a preview.

      The text \`lorem ipsum\\...\` will be replaced with the real content.

      All I hear is \`\\...yada, yada, yada\\...\`.
      `
      const expected = heredoc`
      # Title

      Visit \`http://localhost:8080\` or \`http://127.0.0.1:8080\` in your browser to see a preview.

      The text \`lorem ipsum...\` will be replaced with the real content.

      All I hear is \`...yada, yada, yada...\`.
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should not convert marked phrase inside a word', () => {
      const input = heredoc`
      #foo#bar

      foo[.role]#bar#
      `
      const expected = input
      expect(downdoc(input)).to.equal(expected)
    })

    it('should not convert character reference as marked phrase', () => {
      const input = heredoc`
      &#169; and &#174; are trademark symbols

      [.role]#&169; and [.role]&#174; should be left as is.
      `
      const expected = input
      expect(downdoc(input)).to.equal(expected)
    })

    it('should leave escaped marked phrase escaped', () => {
      const input = heredoc`
      Use the syntax \\#phrase here# to highlight text.

      \\#hashtag is a tag or a URL fragment, but not a phone#
      `
      const expected = input
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should drop attribute list in front of formatted text', () => {
      const input = heredoc`
      = Title

      Use downdoc to convert [.path]_README.adoc_ to [.path]_README.md_ *before* publishing.
      `
      const expected = heredoc`
      # Title

      Use downdoc to convert _README.adoc_ to _README.md_ **before** publishing.
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should substitute double smart quotes', () => {
      const input = heredoc`
      Before you say "\`no way\`", I say "\`try before you deny\`".

      That "\`bug\`" is actually a feature of the software.
      `
      const expected = heredoc`
      Before you say <q>no way</q>, I say <q>try before you deny</q>.

      That <q>bug</q> is actually a feature of the software.
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should allow double smarts quotes replacement to be controlled by quotes attribute', () => {
      const input = heredoc`
      :quotes: “ ”

      Before you say "\`no way\`", I say "\`try before you deny\`".

      That "\`bug\`" is actually a feature of the software.
      `
      const expected = heredoc`
      Before you say “no way”, I say “try before you deny”.

      That “bug” is actually a feature of the software.
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should substitute curly apostrophe', () => {
      const input = heredoc`
      That\`'s probably not going to work.

      That's probably not going to work.

      The \`'90s was the heydey of alternative rock.

      Ruby 2.6's endless range operator is a useful addition.

      Qu'est ce qu'AsciiDoc ?

      Enclose the value in single quotes (\`'\`) to apply normal substitutions to it.
      `
      const expected = heredoc`
      That’s probably not going to work.

      That’s probably not going to work.

      The ’90s was the heydey of alternative rock.

      Ruby 2.6’s endless range operator is a useful addition.

      Qu’est ce qu’AsciiDoc ?

      Enclose the value in single quotes (\`'\`) to apply normal substitutions to it.
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should replace inline anchor with anchor tag', () => {
      const input = heredoc`
      You can learn about <<foo,foo>>, <<bar,bar>>, and <<baz,baz>>.

      [[foo]]all about foo

      * [[bar]]all about bar

      |===
      |[[baz]]all about baz
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should rewrite explicit ID to auto-generated ID and support explicit reftext', () => {
      const input = heredoc`
      = HOWTO

      You'll learn [how] to <<build>> and xref:deploy[] your site.

      [#build,reftext=Build]
      == Build Your Site

      Instructions go here.

      [[deploy,Deploy]]
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should convert link macro to relative file', () => {
      const input = heredoc`
      = Title

      See link:LICENSE[LICENSE] or link:LICENSE[] to find the license text.
      `
      const expected = heredoc`
      # Title

      See [LICENSE](LICENSE) or [LICENSE](LICENSE) to find the license text.
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should not match link: prefix followed by colon', () => {
      const input = heredoc`
      = Title

      See <<docname:image-xref-and-link:::>> to learn more.

      [#docname:image-xref-and-link:::]
      == Link to Resource from Image
      `
      const expected = heredoc`
      # Title

      See [Link to Resource from Image](#link-to-resource-from-image) to learn more.

      ## Link to Resource from Image
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should not process non-escaped bare URL', () => {
      const input = heredoc`
      Navigate to http://localhost:8080/app to view your application.

      The https://example.org domain name is for tests, tutorials, and examples.
      `
      const expected = heredoc`
      Navigate to http://localhost:8080/app to view your application.

      The https://example.org domain name is for tests, tutorials, and examples.
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should hide escaped bare URL', () => {
      const input = heredoc`
      The site will be running at \\http://localhost:8080/app.

      The \\https://example.org domain name is for tests, tutorials, and examples.
      `
      const expected = heredoc`
      The site will be running at <span>http://</span>localhost:8080/app.

      The <span>https://</span>example.org domain name is for tests, tutorials, and examples.
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should ignore inline macros if target contains space', () => {
      const input = heredoc`
      link:not processed.html[]

      xref:not processed.adoc[]

      image:not processed.png[]

      https://example.org/not processed.html[]
      `
      expect(downdoc(input)).to.equal(input)
    })
  })

  describe('image macros', () => {
    it('should convert local inline image', () => {
      const input = heredoc`
      = Title

      When you see image:images/green-bar.png[green bar], you know the tests have passed!

      When you see image:images/red-bar.png[], something has gone wrong.
      `
      const expected = heredoc`
      # Title

      When you see ![green bar](images/green-bar.png), you know the tests have passed!

      When you see ![red-bar.png](images/red-bar.png), something has gone wrong.
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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

      When you see ![red-bar.png](images/red-bar.png), something has gone wrong.
      `
      expect(downdoc(input)).to.equal(expected)
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

      ![screenshot.png](images/screenshot.png)
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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

      ![screenshot.png](images/screenshot.png)
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should not convert local block image within a paragraph', () => {
      const input = heredoc`
      A block image macro uses the following form:
      image::target[]
      `
      expect(downdoc(input)).to.equal(input)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should support conums up to 10', () => {
      const input = `----\n${[...Array(10)].map((_, i) => '<' + (i + 1) + '>').join('\n')}\n----`
      expect(downdoc(input)).to.include('⑩')
    })

    it('should support autonumbered conums up to 10', () => {
      const input = `----\n${Array(10).fill('<.>').join('\n')}\n----`
      expect(downdoc(input)).to.include('⑩')
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(input.replace(/</g, '&lt;'))
    })

    it('should retain unordered list', () => {
      const input = heredoc`
      * work
      * play
      * drink

      paragraph

      * and party!
      `
      expect(downdoc(input)).to.equal(input)
    })

    it('should remove blank lines between unordered list items', () => {
      const input = heredoc`
      * work

      * play


      * drink

      and party!
      `
      const expected = heredoc`
      * work
      * play
      * drink

      and party!
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should convert nested unordered lists', () => {
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input, { attributes: { 'markdown-list-indent': '4' } })).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should support - as unordered list marker', () => {
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should remove blank lines between ordered list items', () => {
      const input = heredoc`
      . one

      . two


      . three

      done
      `
      const expected = heredoc`
      1. one
      2. two
      3. three

      done
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should start new list at block attribute line with empty attrlist', () => {
      const input = heredoc`
      . one
      . two

      []
      . one
      `
      const expected = heredoc`
      1. one
      2. two

      1. one
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should convert nested ordered lists', () => {
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should convert description list into unordered list with bold first line', () => {
      const input = heredoc`
      term:: desc

      another term::
      desc
      +
      attached paragraph

      yet another term:: desc
      `
      const expected = heredoc`
      * **term**\\
      desc
      * **another term**\\
      desc

        attached paragraph
      * **yet another term**\\
      desc
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should not match double colon embedded in description list term', () => {
      const input = heredoc`
      foo::bar:: baz

      ::foo::
      bar
      `
      const expected = heredoc`
      * **foo::bar**\\
      baz
      * **::foo**\\
      bar
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should not match line with only double colon at start of line as description list entry', () => {
      const input = heredoc`
      ::

      ::foo
      `
      const expected = input
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should convert colist to numbered list', () => {
      const input = heredoc`
      = Document Title

      <1> Prints the number 1.
      <2> Exits the program.
      `
      const expected = heredoc`
      # Document Title

      1. Prints the number 1.
      2. Exits the program.
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should not process list continuation outside of list', () => {
      const input = heredoc`
      +
      paragraph
      `
      expect(downdoc(input)).to.equal(input)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

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
      `
      const expected = heredoc`
      # Title

      Summary

      More summary
      `
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should skip single line conditional directive if condition is false', () => {
      const input = heredoc`
      = Title

      ifdef::flag[ignored line]
      Summary
      `
      const expected = heredoc`
      # Title

      Summary
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should keep and process text from single line conditional directive if condition is true', () => {
      const input = heredoc`
      = Title
      :foo: bar

      ifndef::bar[{foo}]
      `
      const expected = heredoc`
      # Title

      bar
      `
      expect(downdoc(input)).to.equal(expected)
    })

    it('should not remove unmatched endif::[] directive', () => {
      const input = heredoc`
      before
      endif::[]
      after
      `
      expect(downdoc(input)).to.equal(input)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should trim trailing space', () => {
      const input = heredoc`
      first paragraph

      second paragraph
      `
      expect(downdoc(input + '\n  ')).to.equal(input)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should trim leading blank lines after applying subs', () => {
      const input = heredoc`
      {empty}
      Visible content.
      `
      const expected = 'Visible content.'
      expect(downdoc(input)).to.equal(expected)
    })
  })

  describe('unsupported', () => {
    it('should not convert inline stem macro', () => {
      const input = heredoc`
      = Title

      The solution is stem:[x^2 + y^2].
      `
      const expected = heredoc`
      # Title

      The solution is stem:[x^2 + y^2].
      `
      expect(downdoc(input)).to.equal(expected)
    })

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
      expect(downdoc(input)).to.equal(expected)
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
      expect(downdoc(input)).to.equal(expected)
    })

    it('should not process preprocessor conditionals inside verbatim block', () => {
      const input = heredoc`
      :foo: bar

      ----
      ifdef::foo[]
      foo is set
      endif::[]
      ----
      `
      const expected = heredoc`
      \`\`\`
      ifdef::foo[]
      foo is set
      endif::[]
      \`\`\`
      `
      expect(downdoc(input)).to.equal(expected)
    })
  })
})
