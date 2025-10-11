/* eslint-env mocha */
'use strict'

const { expect, heredoc } = require('./harness')
const downdoc = require('downdoc')

describe('stem macro passthrough', () => {
  it('should protect stem macro content from formatting interference', () => {
    const input = '*stem:[V^{**}]*'
    const result = downdoc(input)
    expect(result).to.equal('**$V^{**}$**')
  })

  it('should handle stem macro with multiple asterisks', () => {
    const input = '*stem:[V^{***}]*'
    const result = downdoc(input)
    expect(result).to.equal('**$V^{***}$**')
  })

  it('should handle stem macro with escaped brackets', () => {
    const input = '*stem:[V^{**\\]}]*'
    const result = downdoc(input)
    expect(result).to.equal('**$V^{**]}$**')
  })

  it('should handle stem macro in normal text', () => {
    const input = 'The formula *stem:[V^{**}]* is important'
    const result = downdoc(input)
    expect(result).to.equal('The formula **$V^{**}$** is important')
  })

  it('should handle multiple stem macros in same line', () => {
    const input = 'stem:[x+y] and stem:[a*b]'
    const result = downdoc(input)
    expect(result).to.equal('$x+y$ and $a*b$')
  })

  it('should handle stem macros with complex mathematical expressions', () => {
    const input = 'stem:[\\sqrt{x^2 + y^2}] and stem:[\\frac{a}{b}]'
    const result = downdoc(input)
    expect(result).to.equal('$\\sqrt{x^2 + y^2}$ and $\\frac{a}{b}$')
  })

  it('should handle stem macros with formatting characters', () => {
    const input = '*stem:[V^{**}]*, _stem:[x+y]_, and `stem:[a*b]`'
    const result = downdoc(input)
    expect(result).to.equal('**$V^{**}$**, _$x+y$_, and `$a*b$`')
  })

  it('should handle stem macros in different contexts', () => {
    const input = heredoc`
    = Title

    The equation *stem:[E=mc^2]* is famous.

    .Example
    stem:[\\sum_{i=1}^n i = \\frac{n(n+1)}{2}]

    == Section with stem:[x^2]
    `
    const expected = heredoc`
    # Title

    The equation **$E=mc^2$** is famous.

    **Example**

    $\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$

    ## Section with $x^2$
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should handle stem macros with special characters', () => {
    const input = 'stem:[α + β = γ] and stem:[∀x∃y]'
    const result = downdoc(input)
    expect(result).to.equal('$α + β = γ$ and $∀x∃y$')
  })

  it('should handle stem macros with escaped content', () => {
    const input = 'stem:[a\\]b] and stem:[c\\[d]'
    const result = downdoc(input)
    expect(result).to.equal('$a]b$ and $c\\[d$')
  })

  it('should handle stem macros in lists', () => {
    const input = heredoc`
    * stem:[x+y]
    * *stem:[V^{**}]* is bold
    * _stem:[a*b]_ is italic
    `
    const expected = heredoc`
    * $x+y$
    * **$V^{**}$** is bold
    * _$a*b$_ is italic
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should handle stem macros in tables', () => {
    const input = heredoc`
    |===
    | Formula | Description

    | stem:[E=mc^2]
    | Energy-mass equivalence

    | *stem:[V^{**}]* 
    | Bold formula
    |===
    `
    const expected = heredoc`
    | Formula | Description |
    | --- | --- |
    | $E=mc^2$ | Energy-mass equivalence |
    | **$V^{**}$**  | Bold formula |
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should handle stem macros with mixed formatting', () => {
    const input = '*stem:[V^{**}]*, _stem:[x+y]_, `stem:[a*b]`, and #stem:[c+d]#'
    const result = downdoc(input)
    expect(result).to.equal('**$V^{**}$**, _$x+y$_, `$a*b$`, and <mark>$c+d$</mark>')
  })

  it('should handle stem macros with attribute references', () => {
    const input = heredoc`
    :formula: E=mc^2

    The formula stem:[{formula}] is famous.
    `
    const result = downdoc(input)
    expect(result).to.equal('The formula ${formula}$ is famous.')
  })

  it('should handle stem macros in block titles', () => {
    const input = heredoc`
    .stem:[x^2] Example
    ----
    code
    ----
    `
    const expected = heredoc`
    **$x^2$ Example**

    \`\`\`
    code
    \`\`\`
    `
    expect(downdoc(input)).to.equal(expected)
  })

  it('should handle stem macros in admonitions', () => {
    const input = heredoc`
    NOTE: Remember the formula *stem:[V^{**}]*.

    TIP: Use stem:[\\sqrt{x}] for square root.
    `
    const expected = heredoc`
    **📌 NOTE**\\
    Remember the formula **$V^{**}$**.

    **💡 TIP**\\
    Use $\\sqrt{x}$ for square root.
    `
    expect(downdoc(input)).to.equal(expected)
  })
})
