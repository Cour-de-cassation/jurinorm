export const removeOrReplaceUnnecessaryCharacters = (rawString: string): string => {
  // Regular expressions to remove specific characters
  const tabOrPageBreakRegex = /\t|\f/gi
  const carriageReturnRegex = /\r\n|\r/gi
  const multipleSpaceRegex = /[ ]{2,}/gi

  // Replace every tab or pageBreak character with a single space
  const stringWithoutTabOrPageBreak = rawString.replace(tabOrPageBreakRegex, ' ')

  // Replace every carriageReturn character with a newline character
  const stringWithoutCarriageReturn = stringWithoutTabOrPageBreak.replace(carriageReturnRegex, '\n')

  // Replace multiple consecutive spaces with a single space
  const normalizedText = stringWithoutCarriageReturn.replace(multipleSpaceRegex, ' ')

  return normalizedText
}
