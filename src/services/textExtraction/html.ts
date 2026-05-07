import { decode } from 'html-entities'
import { convert } from 'html-to-text'
import { JSDOM } from 'jsdom'

import { logger } from '../../config/logger'
import { MissingValue } from '../error'

export function composeHtmlToText(
  html: string,
  convertFn: (x: string) => string,
  ...restConvertFn: ((x: string) => string)[]
): string {
  const [nextFn, ...restFn] = restConvertFn
  return nextFn ? composeHtmlToText(convertFn(html), nextFn, ...restFn) : convertFn(html)
}

export function removeExtraSpace(plainText: string): string {
  // '\s' without '\n', '\r' , '\v':
  const moreOfOneSpace =
    /[\f\t\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+[\f\t\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/gm
  return plainText.replace(moreOfOneSpace, ' ')
}

export function removeExtraLineBreaks(plainText: string): string {
  // '\s' without '\n', '\r' , '\v':
  const emptyLineWithSpace =
    /\n[\f\t\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+\n/gm
  return plainText.replace(emptyLineWithSpace, '\n\n').replace(/\n+\n/gm, '\n\n')
}

export function removeExtraTables(plainText: string): string {
  // 4. Add a line break after every table header and row:
  plainText = plainText.replace(/<\/th>/gim, '</th>\n')
  plainText = plainText.replace(/<\/tr>/gim, '</tr>\n')
  // 5. Remove whole tables that contain:
  //    - any nested tables
  //    - more thant 15 rows
  //    - more than 2 columns and no "partie"
  const dom = new JSDOM(plainText)
  dom.window.document.querySelectorAll('table:has(table)').forEach((tableWithNestedTable) => {
    tableWithNestedTable.outerHTML = '<p block-type="Text">[…]</p>'
  })
  dom.window.document
    .querySelectorAll('table:has(tr:nth-child(16))')
    .forEach((tableWithTooManyRows) => {
      if (
        /(demandeur|d[ée]fendeur|repr[ée]sent[ée]|mandataire|avocat|juge)/gim.test(
          tableWithTooManyRows.outerHTML
        ) === false
      ) {
        tableWithTooManyRows.outerHTML = '<p block-type="Text">[…]</p>'
      }
    })
  dom.window.document
    .querySelectorAll('table:has(th:nth-child(3))')
    .forEach((tableWithTooManyColumns) => {
      if (
        /(demandeur|d[ée]fendeur|repr[ée]sent[ée]|mandataire|avocat|juge)/gim.test(
          tableWithTooManyColumns.outerHTML
        ) === false
      ) {
        tableWithTooManyColumns.outerHTML = '<p block-type="Text">[…]</p>'
      }
    })
  dom.window.document
    .querySelectorAll('table:has(td:nth-child(3))')
    .forEach((tableWithTooManyColumns) => {
      if (
        /(demandeur|d[ée]fendeur|repr[ée]sent[ée]|mandataire|avocat|juge)/gim.test(
          tableWithTooManyColumns.outerHTML
        ) === false
      ) {
        tableWithTooManyColumns.outerHTML = '<p block-type="Text">[…]</p>'
      }
    })

  return dom.serialize()
}

export function removeInlineMath(plainText: string): string {
  const dom = new JSDOM(plainText)

  dom.window.document.querySelectorAll('p[block-type="TextInlineMath"]').forEach((textToIgnore) => {
    textToIgnore.outerHTML = '<p block-type="Text">[…]</p>'
  })

  return dom.serialize()
}

export function removeExtraBody(plainText: string): string {
  return plainText
    .replace(/\n/gm, '\\n')
    .replace(/^.*<body>/gim, '')
    .replace(/<\/body>.*$/gim, '')
    .replace(/\\n/gm, '\n')
}

export function convertHtmlToText(html: string): string {
  return convert(html, {
    wordwrap: false,
    preserveNewlines: true,
    selectors: [
      {
        selector: '*',
        options: {
          ignoreHref: true
        }
      },
      {
        selector: 'img',
        format: 'skip'
      },
      {
        selector: 'h1',
        options: {
          uppercase: false
        }
      },
      {
        selector: 'h2',
        options: {
          uppercase: false
        }
      },
      {
        selector: 'h3',
        options: {
          uppercase: false
        }
      },
      {
        selector: 'h4',
        options: {
          uppercase: false
        }
      },
      {
        selector: 'h5',
        options: {
          uppercase: false
        }
      },
      {
        selector: 'h6',
        options: {
          uppercase: false
        }
      },
      {
        selector: 'blockquote',
        format: 'inline'
      }
    ]
  })
}

export function removeOrReplaceUnnecessaryCharacters(rawString: string): string {
  const tabOrPageBreakRegex = /\t|\f/gi
  const carriageReturnRegex = /\r\n|\r/gi

  return rawString
    .replace(tabOrPageBreakRegex, ' ')
    .replace(carriageReturnRegex, '\n')
    .replace(/\n[\*\-_=#\s]+\n/gm, '\n\n')
}

export function replaceThreeDots(plainText: string): string {
  return plainText.replace(/\.\.\./gm, '…').replace(/(?:\[…\]\s*\n+\s*)+\[…\]/gm, '\n\n[…]\n\n')
}

export function fixToAssureFinalDot(plainText) {
  const utilPlainText = plainText.trim()
  return /[:,;.-]$/.test(utilPlainText) ? utilPlainText : utilPlainText + '.'
}

export function isEmptyText(text: string): boolean {
  text = `${text}`.replace(/[\t\s\r\n]/gm, '').trim()
  return text.length === 0
}

export function hasNoBreak(text: string): boolean {
  const hasBreak = `${text}`.includes('\n')
  return hasBreak === false
}

export function throwOnEmpty(plainText: string): string {
  if (!plainText || isEmptyText(plainText) || hasNoBreak(plainText)) {
    const error = new MissingValue(
      'plainText',
      'Le texte retourné est vide ou potentiellement incomplet'
    )
    throw error
  }
  return plainText
}

export function htmlToPlainText(input: string): string {
  try {
    return composeHtmlToText(
      input,
      decode,
      removeExtraSpace,
      removeExtraTables,
      removeInlineMath,
      removeExtraBody,
      convertHtmlToText,
      replaceThreeDots,
      removeExtraLineBreaks,
      removeOrReplaceUnnecessaryCharacters,
      fixToAssureFinalDot,
      throwOnEmpty
    )
  } catch (err) {
    logger.error({
      path: __filename,
      operations: ['extraction', 'htmlToPlainText'],
      stack: err.stack,
      message: JSON.stringify({
        error: err.message,
        data: {
          input: input
        }
      })
    })
  }
}
