import { existsSync, unlinkSync, writeFileSync } from 'fs'
import { readWordperfectDocument } from './transformWPDtoText'

export async function transformDecisionIntegreFromWPDToText(
  decisionIntegre: Buffer,
  filename: string
): Promise<string> {
  writeFileSync(filename, Buffer.from(decisionIntegre.buffer), {
    encoding: 'binary'
  })
  try {
    const decisionIntegreContent = await readWordperfectDocument(filename)
    return decisionIntegreContent
  } catch (error) {
    throw new Error('Could not get decision ' + filename + ' content.')
  } finally {
    deleteTemporaryDecisionIntegre(filename)
  }
}

function deleteTemporaryDecisionIntegre(filename: string) {
  if (existsSync(filename)) {
    unlinkSync(filename)
  }
}
