import { htmlToPlainText, removeOrReplaceUnnecessaryCharacters } from './html'

describe(`${__dirname}/textExtraction/html.ts`, () => {
  describe('HtmlToPlainText', () => {
    it('should change a html into a plain text', () => {
      const html = '<html><h1>Title</h1><p>This text is a html.</p></html>'

      const result = htmlToPlainText(html)

      expect(result).toBe('Title\n\nThis text is a html.')
    })

    it('should remove extra spaces', () => {
      const html = '<html><h1>Title</h1><p>This    text is a   html.</p></html>'

      const result = htmlToPlainText(html)

      expect(result).toBe('Title\n\nThis text is a html.')
    })

    //remove tables:
    it('should add a line break after every table header and row', () => {
      const html =
        '<html><p>Something before table</p><table><tr><th>headA</th><th>head B</th></tr><tr><td>row A</td><td>row B</td></tr></table><p>Something after table</p></html>'

      const result = htmlToPlainText(html)

      expect(result).toContain('\n\nSomething after table.')
    })

    it('should remove tables if table nested', () => {
      const html = `<html><p>Something before table</p><table><tr><td><table>hello</table></td></tr></table><p>Something after table</p></html>`

      const result = htmlToPlainText(html)

      expect(result).toBe('Something before table\n\n[…]\n\nSomething after table.')
    })

    it('should remove tables if too many rows', () => {
      const rows = Array(16).fill('<tr><td>row</td></tr>')
      const html = `<html><p>Something before table</p><table>${rows.join('')}</table><p>Something after table</p></html>`

      const result = htmlToPlainText(html)

      expect(result).toBe('Something before table\n\n[…]\n\nSomething after table.')
    })

    it('should remove tables if too many columns', () => {
      const datas = Array(4).fill('<th>data</th>')
      const html = `<html><p>Something before table</p><table><tr>${datas.join('')}</tr></table><p>Something after table</p></html>`

      const result = htmlToPlainText(html)

      expect(result).toBe('Something before table\n\n[…]\n\nSomething after table.')
    })

    it('should remove tables if too many columns', () => {
      const datas = Array(4).fill('<td>data</td>')
      const html = `<html><p>Something before table</p><table><tr>${datas.join('')}</tr></table><p>Something after table</p></html>`

      const result = htmlToPlainText(html)

      expect(result).toBe('Something before table\n\n[…]\n\nSomething after table.')
    })

    //specific:
    it('should remove p with TextInlineMath', () => {
      const html = `<html><p>Something before</p><p block-type="TextInlineMath" >3 + 3</p></html>`

      const result = htmlToPlainText(html)

      expect(result).toBe('Something before\n\n[…].')
    })

    //clean:
    it('should ignore before and after body', () => {
      const html = `<html><head><style>before</style></head><body><h1>Title</h1><p>This text is a html.</p></body><script>after</script></html>`

      const result = htmlToPlainText(html)

      expect(result).toBe('Title\n\nThis text is a html.')
    })

    it('should keep return to newline', () => {
      const html = `<html><body><h1>Title</h1><p>This text\nis a html\nwith lines.</p></body></html>`

      const result = htmlToPlainText(html)

      expect(result).toBe('Title\n\nThis text\nis a html\nwith lines.')
    })

    //serialize HTML

    it('should remove inlines selectors', () => {
      const html = `<html><body><h1>Title</h1><a>This </a><span>text </span><strong>is </strong><em>a </em><b>html </b><u>on </u><i>only </i><small>one </small><sup>line: </sup><sub>one, </sub><blockquote>two, </blockquote><math>three, </math><u>four</u></body></html>`

      const result = htmlToPlainText(html)

      expect(result).toBe('Title\n\nThis text is a html on only one line: one, two, three, four.')
    })

    it('should remove totally img selectors', () => {
      const html = `<html><body><h1>Title</h1><p>This html contains an image</p><img src="image.jpg" alt="Description de l'image" width="300" height="200"/></body></html>`

      const result = htmlToPlainText(html)

      expect(result).toBe('Title\n\nThis html contains an image.')
    })

    it('should remove extra line breaks', () => {
      const html = `<html><body><h1>Title</h1><p>useless space replaces: <br/>   <br/><br/>  <br/><br/><br/>by 2 linebreaks</p></body></html>`

      const result = htmlToPlainText(html)

      expect(result).toBe('Title\n\nuseless space replaces:\n\nby 2 linebreaks.')
    })

    it('should remove useless stuff', () => {
      const html = `<html><body><h1>Title</h1><p>Many things to [...] doesn't display\n*\nor\n-\nuseless</p></body></html>`

      const result = htmlToPlainText(html)

      expect(result).toBe("Title\n\nMany things to […] doesn't display\n\nor\n\nuseless.")
    })
  })

  describe('removeOrReplaceUnnecessaryCharacters', () => {
    it('replaces multiple return character \r to a newline character \n', () => {
      // GIVEN
      const rawString = 'A string with \r character \r'
      const trueString = 'A string with \n character \n'
      // WHEN
      const normalizedString = removeOrReplaceUnnecessaryCharacters(rawString)
      // THEN
      expect(normalizedString).toEqual(trueString)
    })

    it('replaces multiple \r\n to newline characters \n', () => {
      // GIVEN
      const rawString = 'A string with \r\n character \r\n'
      const trueString = 'A string with \n character \n'

      // WHEN
      const normalizedString = removeOrReplaceUnnecessaryCharacters(rawString)

      // THEN
      expect(normalizedString).toEqual(trueString)
    })

    it('replaces \r\n and \r in the same sentence to newline characters \n', () => {
      // GIVEN
      const rawString = 'A string with \r\n character \r'
      const trueString = 'A string with \n character \n'

      // WHEN
      const normalizedString = removeOrReplaceUnnecessaryCharacters(rawString)

      // THEN
      expect(normalizedString).toEqual(trueString)
    })
  })
})
