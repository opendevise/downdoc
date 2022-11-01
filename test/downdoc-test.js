/* eslint-env mocha */
'use strict'

const { expect, outdent } = require('./harness')
const downdoc = require('downdoc')

describe('downdoc()', () => {
  it('should convert document with only body', () => {
    const input = 'body'
    expect(downdoc(input)).to.equal(input)
  })

  it('should convert document title', () => {
    const input = outdent`
      = Title
    `
    const expected = outdent`
      # Title
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should discard author line with single author', () => {
    const input = outdent`
      = Title
      Doc Writer <doc@example.org>

      Body written by {author}.
    `
    const expected = outdent`
      # Title

      Body written by Doc Writer.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should discard author line with multiple authors', () => {
    const input = outdent`
      = Title
      Doc Writer <doc@example.org>; Junior Écrivain <jr@example.org>

      Body written by {authors}.
    `
    const expected = outdent`
      # Title

      Body written by Doc Writer, Junior Écrivain.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert section titles', () => {
    const input = outdent`
      = Title

      == Level 1

      content

      === Level 2

      ==== Level 3

      content

      == Another Level 1
    `
    const expected = outdent`
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

  it('should remove attribute entries found in document header', () => {
    const input = outdent`
      = Title
      :foo: bar
      :yin: yang

      Body
    `
    const expected = outdent`
      # Title

      Body
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should remove attribute entries found in body', () => {
    const input = outdent`
      = Title

      before

      :ignore-me:

      after
    `
    const expected = outdent`
      # Title

      before

      after
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should replace attribute reference', () => {
    const input = outdent`
      = Title
      :project-name: ACME

      The name of this project is {project-name}.
    `
    const expected = outdent`
      # Title

      The name of this project is ACME.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should replace attribute reference in value of attribute entry', () => {
    const input = outdent`
      = Title
      :project-slug: acme
      :url-org: https://example.org
      :url-project: {url-org}/{project-slug}

      The URL for this project is {url-project}.
    `
    const expected = outdent`
      # Title

      The URL for this project is https://example.org/acme.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should replace multiple attribute references in same line', () => {
    const input = outdent`
      = Title
      :author-1: Jim
      :author-2: Jane

      This project was created by {author-1} and {author-2}.
    `
    const expected = outdent`
      # Title

      This project was created by Jim and Jane.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should set value of attribute entry to empty string if value is not specified', () => {
    const input = outdent`
      = Title
      :empty-string:

      foo{empty-string}bar
    `
    const expected = outdent`
      # Title

      foobar
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should skip unresolved attribute reference', () => {
    const input = outdent`
      = Title

      This project is named {unknown}.
    `
    const expected = outdent`
      # Title

      This project is named {unknown}.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should expand ifdef enclosure on attribute entry in header for defined attribute', () => {
    const input = outdent`
      = Title
      :project-handle: downdoc
      ifdef::project-handle[:url-project: https://example.org/{project-handle}]

      This project is named {project-handle}.
      The URL of the project is {url-project}.
    `
    const expected = outdent`
      # Title

      This project is named downdoc.
      The URL of the project is https://example.org/downdoc.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should skip ifdef enclosure on attribute entry in header for undefined attribute', () => {
    const input = outdent`
      = Title
      ifdef::env-github[:toc-title: Contents]

      {toc-title}
    `
    const expected = outdent`
      # Title

      {toc-title}
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should expand ifndef enclosure on attribute entry in header for undefined attribute', () => {
    const input = outdent`
      = Title
      ifndef::project-handle[:project-handle: downdoc]
      :url-project: https://example.org/{project-handle}

      This project is named {project-handle}.
      The URL of the project is {url-project}.
    `
    const expected = outdent`
      # Title

      This project is named downdoc.
      The URL of the project is https://example.org/downdoc.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should skip ifndef enclosure on attribute entry in header for defined attribute', () => {
    const input = outdent`
      = Title
      :project-handle: downdoc
      ifndef::project-handle[:project-handle: foobar]
      :url-project: https://example.org/{project-handle}

      This project is named {project-handle}.
      The URL of the project is {url-project}.
    `
    const expected = outdent`
      # Title

      This project is named downdoc.
      The URL of the project is https://example.org/downdoc.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert URL macro', () => {
    const input = outdent`
      = Title

      These tests are run using https://mochajs.org[Mocha].
    `
    const expected = outdent`
      # Title

      These tests are run using [Mocha](https://mochajs.org).
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert URL macro defined using attribute reference', () => {
    const input = outdent`
      = Title
      :url-mocha: https://mochajs.org

      These tests are run using {url-mocha}[Mocha].
    `
    const expected = outdent`
      # Title

      These tests are run using [Mocha](https://mochajs.org).
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert link macro to relative file', () => {
    const input = outdent`
      = Title

      See link:LICENSE[LICENSE] or link:LICENSE[] to find the license text.
    `
    const expected = outdent`
      # Title

      See [LICENSE](LICENSE) or [LICENSE](LICENSE) to find the license text.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert URL macro with link macro prefix', () => {
    const input = outdent`
      = Title

      These tests are run using link:https://mochajs.org[Mocha].
    `
    const expected = outdent`
      # Title

      These tests are run using [Mocha](https://mochajs.org).
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert remote image', () => {
    const input = outdent`
      = Title

      * image:https://cdn.jsdelivr.net/gh/madebybowtie/FlagKit/Assets/PNG/FR.png[fr]
    `
    const expected = outdent`
      # Title

      * ![fr](https://cdn.jsdelivr.net/gh/madebybowtie/FlagKit/Assets/PNG/FR.png)
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert bold formatting', () => {
    const input = outdent`
      = Title

      You *really* need to check *this* out!
    `
    const expected = outdent`
      # Title

      You **really** need to check **this** out!
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert italic formatting', () => {
    const input = outdent`
      = Title

      This is _so_ incredibly _easy_.
    `
    const expected = outdent`
      # Title

      This is *so* incredibly *easy*.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert monospace formatting', () => {
    const input = outdent`
      = Title

      A boolean value can be \`true\` or \`false\`.
    `
    const expected = outdent`
      # Title

      A boolean value can be \`true\` or \`false\`.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should honor backslash at start of monospace formatting', () => {
    const input = outdent`
      = Title

      Visit \`\\http://localhost:8080\` in your browser to see a preview.
    `
    const expected = outdent`
      # Title

      Visit \`http://localhost:8080\` in your browser to see a preview.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should drop attribute list in front of formatted text', () => {
    const input = outdent`
      = Title

      Use downdoc to convert [.path]_README.adoc_ to [.path]_README.md_ *before* publishing.
    `
    const expected = outdent`
      # Title

      Use downdoc to convert *README.adoc* to *README.md* **before** publishing.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should drop block attribute list', () => {
    const input = outdent`
      = Title

      [.lead]
      Lead paragraph.
    `
    const expected = outdent`
      # Title

      Lead paragraph.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should not drop line that starts with formatting text with attribute list', () => {
    const input = outdent`
      = Title

      [.path]_README.adoc_ contains all the essential information.
    `
    const expected = outdent`
      # Title

      *README.adoc* contains all the essential information.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert admonitions', () => {
    const input = outdent`
      = Title

      NOTE: Remember the milk.

      IMPORTANT: Don't forget the children!

      TIP: Look for the warp zone under the bridge.

      CAUTION: Slippery when wet.

      WARNING: The software you're about to use has not been tested.
    `
    const expected = outdent`
      # Title

      📌 **NOTE:** Remember the milk.

      ❗ **IMPORTANT:** Don't forget the children!

      💡 **TIP:** Look for the warp zone under the bridge.

      🔥 **CAUTION:** Slippery when wet.

      ⚠️ **WARNING:** The software you're about to use has not been tested.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should retain Markdown-style blockquotes', () => {
    const input = outdent`
      = Title

      > Roads?
      >
      > Where we're going, we don't need _roads_!

      The rest is...the future!

      > And away we go!
    `

    const expected = outdent`
      # Title

      > Roads?
      >
      > Where we're going, we don't need *roads*!

      The rest is...the future!

      > And away we go!
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert literal paragraph', () => {
    const input = outdent`
      = Title

      beginning

       literal

      middle

          literal
            so literal

      end
    `
    const expected = outdent`
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
    const input = ' literal paragraph'
    const expected = '    literal paragraph'
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert source block with language', () => {
    const input = outdent`
      = Title

      [,js]
      ----
      const downdoc = require('downdoc')
      console.log(downdoc('= Document Title'))
      ----
    `
    const expected = outdent`
      # Title

      \`\`\`js
      const downdoc = require('downdoc')
      console.log(downdoc('= Document Title'))
      \`\`\`
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert source block without language', () => {
    const input = outdent`
      = Title

      [source]
      ----
      /.cache/
      /node_modules/
      ----
    `
    const expected = outdent`
      # Title

      \`\`\`
      /.cache/
      /node_modules/
      \`\`\`
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert listing block', () => {
    const input = outdent`
      = Title

      ----
      folder/
        file.yml
        subfolder/
          file.js
      ----
    `
    const expected = outdent`
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

  it('should not substitute text in a verbatim block', () => {
    const input = outdent`
      = Title
      :project-name: ACME

      The name of the project is {project-name}.

      [,ruby]
      ----
      puts '{project-name}'
      ----

      {project-name} is awesome.
    `
    const expected = outdent`
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
    const input = outdent`
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
    const expected = outdent`
      # Title

      \`\`\`asciidoc
      = Document Title
      :toc: preamble
      :toc-title: Contents

      preamble

      == Section

      content
      \`\`\`

      Isn't AsciiDoc grand?
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should honor subs=+attributes on source block', () => {
    const input = outdent`
      = Title
      :url-repo: https://github.com/octocat/Spoon-Knife

      [,console,subs=+attributes]
      ----
      $ git clone {url-repo}
      ----
    `
    const expected = outdent`
      # Title

      \`\`\`console
      $ git clone https://github.com/octocat/Spoon-Knife
      \`\`\`
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should honor subs=attributes+ on source block', () => {
    const input = outdent`
      = Title
      :url-repo: https://github.com/octocat/Spoon-Knife

      [,console,subs=attributes+]
      ----
      $ git clone {url-repo}
      ----
    `
    const expected = outdent`
      # Title

      \`\`\`console
      $ git clone https://github.com/octocat/Spoon-Knife
      \`\`\`
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert block title on source block', () => {
    const input = outdent`
      = Title

      .Clone the repository
      [,console]
      ----
      $ git clone https://github.com/octocat/Spoon-Knife
      ----
    `
    const expected = outdent`
      # Title

      **Clone the repository**
      \`\`\`console
      $ git clone https://github.com/octocat/Spoon-Knife
      \`\`\`
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert ordered list to numbered list', () => {
    const input = outdent`
      = Title

      . one
      . two
      . three

      paragraph

      . and one
    `
    const expected = outdent`
      # Title

      1. one
      2. two
      3. three

      paragraph

      1. and one
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should convert colist to numbered list', () => {
    const input = outdent`
      = Document Title

      <1> Prints the number 1.
    `
    const expected = outdent`
      # Document Title

      1. Prints the number 1.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should replace conums in source block with circled numbers', () => {
    const input = outdent`
      = Title

      [,js]
      ----
      'use strict' // <1>

      const fs = require('fs') // <2>
      ----
      <1> Enables strict mode.
      <2> Requires the built-in fs module.
    `
    const expected = outdent`
      # Title

      \`\`\`js
      'use strict' // ❶

      const fs = require('fs') // ❷
      \`\`\`
      1. Enables strict mode.
      2. Requires the built-in fs module.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should skip comment lines and blocks', () => {
    const input = outdent`
      = Title
      ////
      ignored
      ////
      :summary: Summary
      // ignore this line

      ////
      ignore
      these
      lines
      ////

      {summary}

      // ignore this line
      More summary
      //fin
    `
    const expected = outdent`
      # Title

      Summary

      More summary
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should skip table (for now)', () => {
    const input = outdent`
      = Title

      Here's a list of configuration options.

      |===
      | Name | Description

      | dryRun
      | Report what actions will be taken without doing them.
      |===

      That's all.
    `
    const expected = outdent`
      # Title

      Here's a list of configuration options.

      That's all.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should keep contents of ifdef directive block if attribute is set', () => {
    const input = outdent`
      = Title
      :badges:

      ifdef::badges[]
      image:https://img.shields.io/npm/v/downdoc[npm version]
      endif::[]

      Summary
    `
    const expected = outdent`
      # Title

      ![npm version](https://img.shields.io/npm/v/downdoc)

      Summary
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should keep contents of ifndef directive block if attribute is not set', () => {
    const input = outdent`
      = Title

      ifndef::author[]
      There is no author.
      endif::[]

      Summary
    `
    const expected = outdent`
      # Title

      There is no author.

      Summary
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should skip ifdef directive block if attribute is not set and collapse empty lines', () => {
    const input = outdent`
      = Title

      ifdef::not-set[]
      image:https://img.shields.io/npm/v/downdoc[link="https://www.npmjs.com/package/downdoc",title="npm version"]
      endif::[]

      Summary
    `
    const expected = outdent`
      # Title

      Summary
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should skip ifndef directive block if attribute is set and collapse empty lines', () => {
    const input = outdent`
      = Title
      Author Name
      ifdef::author[:attribution: written by {author}]
      garbage

      ifndef::author[]
      There is no author.
      endif::[]

      Summary {attribution}.
    `
    const expected = outdent`
      # Title

      Summary written by Author Name.
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should skip single line conditional directive if condition is false', () => {
    const input = outdent`
      = Title

      ifdef::flag[ignored line]
      Summary
    `
    const expected = outdent`
      # Title

      Summary
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should keep and process text from single line conditional directive if condition is true', () => {
    const input = outdent`
      = Title
      :foo: bar

      ifndef::bar[{foo}]
    `
    const expected = outdent`
      # Title

      bar
    `
    expect(downdoc(input)).to.equal(expected)
  })
})
