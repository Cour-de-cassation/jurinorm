import { 
    composeHtmlToText,
    fixToAssureFinalDot,
    throwOnEmpty
} from "../../../../../services/textExtraction/html"

function tcomPostProcess(plainText: string): string {
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
  plainText = plainText.replace(/(\w)Juge\s?:/gm, '$1\nJuge :')
  plainText = plainText.replace(/\s:(\w)/gm, ' : $1')

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

  // 17. Remove more useless garbage:
  plainText = plainText.replace(/sign[ée]\s[ée]lectroniquement\spar\.?$/gim, '')

  return plainText
}

export function textPostProcess(input: string): string {
  return composeHtmlToText(
    input,
    tcomPostProcess,
    fixToAssureFinalDot,
    throwOnEmpty
  )
}
