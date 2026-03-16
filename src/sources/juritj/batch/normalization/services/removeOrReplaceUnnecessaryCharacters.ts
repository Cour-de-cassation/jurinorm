import { characterReplacementMap } from '../infrastructure/characterReplacementMap'

export const replaceUnknownCharacters = (text: string) => {
  let replacedText = ''
  for (const character of text) {
    if (characterReplacementMap[character] == undefined) {
      replacedText += character
    } else {
      replacedText += characterReplacementMap[character]
    }
  }
  return replacedText
}

export const removeOrReplaceUnnecessaryCharacters = (rawString: string): string => {
  // Fix guillemets:
  const stringWithFixedGuillemets = fixGuillemets(rawString)

  // Regular expressions to remove specific characters
  const tabOrPageBreakRegex = /\t|\f/gi
  const carriageReturnRegex = /\r\n|\r/gi
  const multipleSpaceRegex = /[ ]{2,}/gi

  // Replace tab or pageBreak characters with an empty string
  const stringWithoutTabOrPageBreak = stringWithFixedGuillemets.replace(tabOrPageBreakRegex, ' ')

  // Replace carriageReturn characters with a newline character
  const stringWithoutCarriageReturn = stringWithoutTabOrPageBreak.replace(carriageReturnRegex, '\n')

  // Replace multiple consecutive spaces with a white space
  const stringWithoutConsecutiveSpaces = stringWithoutCarriageReturn.replace(
    multipleSpaceRegex,
    ' '
  )

  // Replace tibetain characters
  const normalizedText = replaceUnknownCharacters(stringWithoutConsecutiveSpaces)

  return normalizedText.trim()
}

export function isEmptyText(text: string): boolean {
  text = `${text}`.replace(/[\t\s\r\n]/gm, '').trim()
  return text.length === 0
}

export function hasNoBreak(text: string): boolean {
  const hasBreak = `${text}`.includes('\n')
  return hasBreak === false
}

function fixGuillemets(originalText: string): string {
  // Guillemets tend to be corrupted in the received WordPerfect file
  // (this issue affects more than half of the decisions):
  // - the opening '«' becomes a tibetan character 'ཋ' (code 3915)
  // - the closing '»' becomes a regular space character (code 32)
  //
  // Once a 'ཋ' character is found, we look for the next occurrence of a
  // double space string (32+32) in order to reconstruct the initial quote.
  //
  // If the current quote cannot be closed, its opening 'ཋ' characters is
  // replaced with a space character.
  //
  // We have to parse the whole text *before* the removing of all consecutive
  // spaces (stringWithoutConsecutiveSpaces), otherwise we lose the
  // end-of-quote condition.
  //
  // The nature of the quoted text makes the use of regexps quite uncertain.

  let text = originalText
  let beginQuoteIndex = -1

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i)
    if (charCode === 3915) {
      // Found a 'ཋ'
      if (beginQuoteIndex !== -1) {
        // Unexpected 'ཋ': remove the previous "unclosed" 'ཋ' and continue with the new one
        text = text.substring(0, beginQuoteIndex) + ' ' + text.substring(beginQuoteIndex + 1)
      }
      beginQuoteIndex = i
    } else if (
      charCode === 32 &&
      i < text.length - 1 &&
      beginQuoteIndex !== -1 &&
      text.charCodeAt(i + 1) === 32
    ) {
      // Found a double space after a 'ཋ':
      // - replace the 'ཋ' with a '«'
      // - replace the second space with a '»'
      text = text.substring(0, beginQuoteIndex) + '«' + text.substring(beginQuoteIndex + 1)
      text = text.substring(0, i + 1) + '»' + text.substring(i + 2)
      beginQuoteIndex = -1
    }
  }

  if (beginQuoteIndex !== -1) {
    // End of text: remove the remaining "unclosed" 'ཋ'
    text = text.substring(0, beginQuoteIndex) + ' ' + text.substring(beginQuoteIndex + 1)
  }

  return text
}
