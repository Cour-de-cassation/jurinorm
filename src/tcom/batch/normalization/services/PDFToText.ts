import { DecisionS3Repository } from '../../../shared/infrastructure/repositories/decisionS3.repository'
import { InfrastructureException } from '../../../shared/infrastructure/exceptions/infrastructure.exception'
import { logger, normalizationFormatLogs } from '../logger'
import { LogsFormat } from '../../../shared/infrastructure/utils/logsFormat.utils'
import * as FormData from 'form-data'
import axios, { AxiosError, AxiosResponse } from 'axios'
import { Marked } from 'marked'
import { PostponeException } from '../infrastructure/nlp.exception'
import { decode } from 'html-entities'
import { convert } from 'html-to-text'
import { JSDOM } from 'jsdom'

export interface NLPPDFToTextDTO {
  markdownText?: string
  HTMLText?: string
  images?: object
  versions?: object
}

export async function fetchPDFFromS3(
  s3Repository: DecisionS3Repository,
  pdfFilename: string
): Promise<Buffer> {
  try {
    return await s3Repository.getPDFByFilename(pdfFilename)
  } catch (error) {
    const formatLogs: LogsFormat = {
      ...normalizationFormatLogs,
      operationName: 'fetchPDFFromS3',
      msg: error.message
    }
    logger.error({
      ...formatLogs
    })
    throw new InfrastructureException(error.message)
  }
}

export async function fetchNLPDataFromPDF(pdfFile: Buffer, pdfFilename: string): Promise<object> {
  const formData: FormData = new FormData()
  formData.append('pdf_file', pdfFile, pdfFilename)
  try {
    const t0 = new Date()
    const response: AxiosResponse = await axios.post(
      `${process.env.NLP_PSEUDONYMISATION_API_URL}/pdf-to-text`,
      formData,
      {
        headers: {
          ...formData.getHeaders()
        }
      }
    )
    if (response && response.data && response.data.pdfPageCount) {
      const t1 = new Date()
      const delta = (t1.getTime() - t0.getTime()) / 1000
      const perPage = delta / response.data.pdfPageCount
      const formatLogs: LogsFormat = {
        ...normalizationFormatLogs,
        operationName: 'fetchNLPDataFromPDF',
        msg: `performed pdf-to-text on file ${pdfFilename}`,
        statusCode: response.status
      }
      logger.info({
        ...formatLogs,
        pdfType: response.data.pdfType,
        pdfPageCount: response.data.pdfPageCount,
        duration: delta.toFixed(4),
        durationAsNumber: delta,
        durationPerPage: perPage.toFixed(4),
        durationPerPageAsNumber: perPage,
        statusCodeAsString: `${response.status}`
      })
    }
    return response.data
  } catch (error) {
    const formatLogs: LogsFormat = {
      ...normalizationFormatLogs,
      operationName: 'fetchNLPDataFromPDF',
      msg: error.message
    }
    if (error instanceof AxiosError) {
      formatLogs.msg = error.code
      formatLogs.statusCode = error.status
      logger.error({
        ...formatLogs,
        statusCodeAsString: `${error.status}`
      })
      if (error.status === 429 || error.status === 500) {
        throw new PostponeException(error.message)
      } else {
        throw new InfrastructureException(error.message)
      }
    } else {
      logger.error({
        ...formatLogs
      })
      throw new InfrastructureException(error.message)
    }
  }
}

export function HTMLToPlainText(input: string): string {
  // 1. Decode HTML entities:
  let plainText = decode(input)

  // 2. Remove inline and useless tags (leaving space so words don't collapse):
  plainText = plainText.replace(
    /<\/?(a|span|strong|em|i|b|u|small|sub|sup|blockquote|math)\/?>/gim,
    ' '
  )

  // 3. Remove extra spaces:
  plainText = plainText.replace(/\s+\s/gm, ' ')

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

  // 6. Remove some specific block types:
  dom.window.document.querySelectorAll('p[block-type="TextInlineMath"]').forEach((textToIgnore) => {
    textToIgnore.outerHTML = '<p block-type="Text">[…]</p>'
  })

  // 7. Get the serialized HTML content back:
  plainText = dom
    .serialize()
    .replace(/\n/gm, '\\n')
    .replace(/^.*<body>/gim, '')
    .replace(/<\/body>.*$/gim, '')
    .replace(/\\n/gm, '\n')

  // 8. Let html-to-text/convert do its confusing job:
  plainText = convert(plainText, {
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
        selector: 'a',
        format: 'inline'
      },
      {
        selector: 'span',
        format: 'inline'
      },
      {
        selector: 'strong',
        format: 'inline'
      },
      {
        selector: 'em',
        format: 'inline'
      },
      {
        selector: 'i',
        format: 'inline'
      },
      {
        selector: 'b',
        format: 'inline'
      },
      {
        selector: 'u',
        format: 'inline'
      },
      {
        selector: 'small',
        format: 'inline'
      },
      {
        selector: 'sub',
        format: 'inline'
      },
      {
        selector: 'sup',
        format: 'inline'
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
      }
    ]
  })

  // 9. Remove extra line breaks and useless stuff:
  plainText = plainText.replace(/\n\s+\n/gm, '\n\n')
  plainText = plainText.replace(/\n+\n/gm, '\n\n')
  plainText = plainText.replace(/\.\.\./gm, '…')
  plainText = plainText.replace(/\n[\*\-_=#\s]+\n/gm, '\n\n')
  plainText = plainText.replace(/(?:\[…\]\s*\n+\s*)+\[…\]/gm, '\n\n[…]\n\n')

  // 10. Cleanup numbered and non-numbered list items:
  plainText = plainText.replace(/\n\s?[\-−]\s?(\w+)/gim, '\n * $1')
  plainText = plainText.replace(/\n\s+\*\s+\n\s+/gm, '\n* ')
  plainText = plainText.replace(/\n\s+(\d+)\.\s+\n\s+/gm, '\n$1. ')
  plainText = plainText.replace(
    /\n\s*([\*\-−¬→↑←➢⇒♦❖♠◆✦●■☐►➤▶▲>♣✓\.οo○·∙٠•_+]\s?\.?)\s+/gim,
    '\n* '
  )
  plainText = plainText.replace(
    /\n\s*\*\s+([\*\-−¬→↑←➢⇒♦❖♠◆✦●■☐►➤▶▲>♣✓\.οo○·∙٠•_+]\s?\.?)\s+/gim,
    '\n* '
  )
  plainText = plainText.replace(/\n\s*\*\s+([a-z]\s?\.?)\s+/gim, '\n$1 ')
  plainText = plainText.replace(/\n\s*\*\s+(\d+)\.\s+/gim, '\n$1. ')
  plainText = plainText.replace(/\n\s*(\d+)\s*\n+\s*([eè][mr]e\s+chambre)/gim, '\n$1$2')
  plainText = plainText.replace(/\n\s*\*\s+/gm, '\n * ')

  // 11. Move isolated non-alphanumeric characters to the end of the previous line:
  plainText = plainText.replace(/\n+(\W\W?)\n/gm, '$1\n')

  // 12. Remove space between alphanumeric characters and common punctuation marks:
  plainText = plainText.replace(/(\w)\s([,.'°])/gm, '$1$2')
  plainText = plainText.trim()

  // 13. Try to reject the appendices after the actual end of the decision:
  const firstRegexp = /(sign[ée]e?\s+[pleé]\w*[a-zéèçàùâêûîôäëüïö,\s.-]*greffier)/i
  const secondRegexp =
    /(par\sces\smotifs\W*(?:(?!par\sces\smotifs).)+l[ea]\s(?:greffi[èe]re?|pr[ée]sidente?))/i
  plainText = plainText.replace(/\n/gm, '\\n') // It's easier to do it without the \n
  if (firstRegexp.test(plainText) === true) {
    const segments = plainText.split(firstRegexp)
    if (segments.length > 1) {
      if (/motifs/i.test(segments[0]) === true) {
        // The "par ces motifs" thing seems to be in the first segment, so we append the signature to it:
        plainText = segments[0] + ' ' + segments[1]
        // If the next segments have no line break, then they could be a tiny bit of the actual decision that we must keep:
        for (let index = 2; index < segments.length; index++) {
          if (
            segments[index] &&
            (/\\n/.test(segments[index].replace(/^\\n/, '').replace(/\\n$/, '')) === false ||
              segments[index].length < segments[index - 1].length)
          ) {
            plainText = plainText + ' ' + segments[index]
          }
        }
        // Reject the rest...
      } else if (segments.length > 3) {
        // Sometimes the signature is mentioned before the "par ces motifs" thing:
        plainText = segments[0] + ' ' + segments[1] + ' ' + segments[2]
        // If the next segments have no line break, then they could be a tiny bit of the actual decision that we must keep:
        if (secondRegexp.test(segments[3])) {
          // Fall back to the second case (see below):
          const other_segments = segments[3].split(secondRegexp)
          if (other_segments.length > 1) {
            if (secondRegexp.test(other_segments[1]) === true) {
              plainText =
                plainText + other_segments[0] + ' ' + other_segments[1].split(secondRegexp)[1]
            } else {
              plainText = plainText + other_segments[0] + ' ' + other_segments[1]
            }
          }
          // Reject the rest...
        } else {
          for (let index = 3; index < segments.length; index++) {
            if (
              segments[index] &&
              (/\\n/.test(segments[index].replace(/^\\n/, '').replace(/\\n$/, '')) === false ||
                segments[index].length < segments[index - 1].length)
            ) {
              plainText = plainText + ' ' + segments[index]
            }
          }
        }
        // Reject the rest...
      } else if (secondRegexp.test(plainText) === true) {
        // Fall back to the second case (see below):
        const segments = plainText.split(secondRegexp)
        if (segments.length > 1) {
          if (secondRegexp.test(segments[1]) === true) {
            plainText = segments[0] + ' ' + segments[1].split(secondRegexp)[1]
            segments.shift()
            segments.shift()
          } else {
            plainText = segments[0] + ' ' + segments[1]
          }
          // If the next segments have no line break, then they could be a tiny bit of the actual decision that we must keep:
          for (let index = 2; index < segments.length; index++) {
            if (
              segments[index] &&
              (/\\n/.test(segments[index].replace(/^\\n/, '').replace(/\\n$/, '')) === false ||
                segments[index].length < segments[index - 1].length)
            ) {
              plainText = plainText + ' ' + segments[index]
            }
          }
          // Reject the rest...
        }
      }
    }
  } else if (secondRegexp.test(plainText) === true) {
    // More regular case?
    const segments = plainText.split(secondRegexp)
    if (segments.length > 1) {
      if (secondRegexp.test(segments[1]) === true) {
        plainText = segments[0] + ' ' + segments[1].split(secondRegexp)[1]
        segments.shift()
        segments.shift()
      } else {
        plainText = segments[0] + ' ' + segments[1]
      }
      // If the next segments have no line break, then they could be a tiny bit of the actual decision that we must keep:
      for (let index = 2; index < segments.length; index++) {
        if (
          segments[index] &&
          (/\\n/.test(segments[index].replace(/^\\n/, '').replace(/\\n$/, '')) === false ||
            segments[index].length < segments[index - 1].length)
        ) {
          plainText = plainText + ' ' + segments[index]
        }
      }
      // Reject the rest...
    }
  }

  // 14. Remove extra spaces (again):
  plainText = plainText.replace(/\s+\s/gm, ' ')
  plainText = plainText.replace(/\\n\s+(\w)/gim, '\\n$1')

  // 15. Remove useless garbage:
  plainText = plainText.replace(/\\n\w+\scompany.*\w\sproperty.*\w\ssecond.*$/gim, '\\n').trim()

  // 16. Put the \n back and ensure there's a "final dot":
  plainText = plainText.replace(/\\n/gm, '\n').trim()
  plainText = plainText.replace(/\n+\n/gm, '\n\n')
  plainText = plainText.replace(/,,/gm, ',')
  plainText = plainText.replace(/\s([,.])$/gm, '$1')
  if (/[:,;.-]$/.test(plainText) === false) {
    plainText = plainText + '.'
  }

  // 17. Remove more useless garbage:
  plainText = plainText.replace(/sign[ée]\s[ée]lectroniquement\spar\.?$/gim, '')

  plainText = plainText.trim()

  if (!plainText || isEmptyText(plainText) || hasNoBreak(plainText)) {
    const error = new InfrastructureException(
      'Le texte retourné est vide ou potentiellement incomplet'
    )
    const formatLogs: LogsFormat = {
      ...normalizationFormatLogs,
      operationName: 'HTMLToPlainText',
      msg: error.message,
      data: {
        input: input,
        output: plainText
      }
    }
    logger.error({
      ...formatLogs
    })
    throw error
  }

  return plainText
}

export function markdownToPlainText(input: string): string {
  let plainText = new Marked({ gfm: true, breaks: true }).parse(input, { async: false })

  // Remove any HTML stuff:
  // 1.a HTML elements:
  plainText = decode(plainText)
  // 1.b Remove every <html> tag:
  plainText = plainText.replace(/<html>/gim, '\n')
  plainText = plainText.replace(/<\/html>/gim, '\n')
  // 1.c Remove every <body> tag:
  plainText = plainText.replace(/<body>/gim, '\n')
  plainText = plainText.replace(/<\/body>/gim, '\n')
  // 2. insert a space at the end of every table cell:
  plainText = plainText.replace(/<\/td>/gim, ' </td>')
  // 3.a. add a \n after each <br>:
  plainText = plainText.replace(/<br\/?>/gim, '<br>\n')
  // 3.b. add a \n before and after each paragraph:
  plainText = plainText.replace(/<p>/gim, '\n<p>')
  plainText = plainText.replace(/<\/p>/gim, '</p>\n')
  // 3.c. add a \n before and after each heading:
  plainText = plainText.replace(/<h(\d+)>/gim, '\n<h$1>')
  plainText = plainText.replace(/<\/h(\d+)>/gim, '</h$1>\n')
  // 3.d. add a \n before and after each tr:
  plainText = plainText.replace(/<tr>/gim, '\n<tr>')
  plainText = plainText.replace(/<\/tr>/gim, '</tr>\n')
  // 3.e. add a \n before and after each table:
  plainText = plainText.replace(/<table>/gim, '\n<table>')
  plainText = plainText.replace(/<\/table>/gim, '</table>\n')
  // 3.f. add a \n before and after each hr:
  plainText = plainText.replace(/<hr\/?>/gim, '\n<hr>\n')
  // 3.g. add a \n before and after each ol:
  plainText = plainText.replace(/<ol>/gim, '\n<ol>')
  plainText = plainText.replace(/<\/ol>/gim, '</ol>\n')
  // 3.h. add a \n before and after each ul:
  plainText = plainText.replace(/<ul>/gim, '\n<ul>')
  plainText = plainText.replace(/<\/ul>/gim, '</ul>\n')
  // 3.i. add a \n after each li:
  plainText = plainText.replace(/<\/li>/gim, '</li>\n')
  // 4. remove extra \n
  plainText = plainText.replace(/\n+/gm, '\n')
  // 5. convert:
  plainText = convert(plainText, {
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
        selector: 'a',
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
      }
    ]
  })
  // 6. remove every tag that could remain:
  plainText = plainText.replace(/<\/?[^>]+(>|$)/gm, '')
  // 7. remove extra \n again (after tag collapsing)
  plainText = plainText.replace(/\n\n/gm, '\n')
  plainText = plainText.trim()

  if (!plainText || isEmptyText(plainText) || hasNoBreak(plainText)) {
    const error = new InfrastructureException(
      'Le texte retourné est vide ou potentiellement incomplet'
    )
    const formatLogs: LogsFormat = {
      ...normalizationFormatLogs,
      operationName: 'markdownToPlainText',
      msg: error.message,
      data: {
        input: input,
        output: plainText
      }
    }
    logger.error({
      ...formatLogs
    })
    throw error
  }
  return plainText
}

export function isEmptyText(text: string): boolean {
  text = `${text}`.replace(/[\t\s\r\n]/gm, '').trim()
  return text.length === 0
}

export function hasNoBreak(text: string): boolean {
  const hasBreak = `${text}`.includes('\n')
  return hasBreak === false
}
