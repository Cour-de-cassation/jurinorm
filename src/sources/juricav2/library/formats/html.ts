import { decodeHTML } from 'entities'

function removeMultipleSpace(str: string): string {
  return str.replace(/  +/gm, ' ').trim()
}

function replaceErroneousChars(str: string): string {
  return str
    .replace(/\x91/gm, '‘')
    .replace(/\x92/gm, '’')
    .replace(/\x80/gm, '€')
    .replace(/\x96/gm, '–')
}

function cleanHTML(html: string): string {
  if (/<html/i.test(html) === false) {
    return html
  }

  // Remove HTML tags:
  html = html.replace(/<\/?[^>]+(>|$)/gm, '')

  // Handling newlines and carriage returns:
  html = html.replace(/\r\n/gim, '\n')
  html = html.replace(/\r/gim, '\n')

  // Remove extra spaces:
  html = html.replace(/\t/gim, ' ')
  html = html.replace(/\\t/gim, ' ') // That could happen...
  html = html.replace(/\f/gim, ' ')
  html = html.replace(/\\f/gim, ' ') // That could happen too...
  html = removeMultipleSpace(html)

  // Mysterious chars (cf. https://www.compart.com/fr/unicode/U+0080, etc.):
  html = replaceErroneousChars(html)

  // Decode HTML entities:
  return decodeHTML(html)
}

export function htmlToPlainText(html: string) {
  const text = cleanHTML(html)
  return text
    .replace(/\*DEB[A-Z]*/gm, '')
    .replace(/\*FIN[A-Z]*/gm, '')
    .trim()
}
