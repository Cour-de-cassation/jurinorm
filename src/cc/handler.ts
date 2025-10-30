import { toUnexpectedError } from '../library/error'
import { RawCc } from './models'
import { countFileInformations, findFileInformations, mapCursorSync } from '../library/DbRawFile'
import { logger } from '../library/logger'
import { COLLECTION_JURINET_RAW } from '../library/env'
import { updateRawFileStatus, NormalizationResult } from '../services/eventSourcing'
import { sendToSder } from '../library/DbSder'
import { annotateDecision } from '../library/nlp/annotation'

export const rawCcToNormalize = {
  // Ne contient pas normalized:
  events: { $not: { $elemMatch: { type: 'normalized' } } },
  // Les 3 derniers events ne sont pas "blocked":
  $expr: {
    $not: {
      $eq: [
        3,
        {
          $size: {
            $filter: {
              input: { $slice: ['$events', -3] },
              as: 'e',
              cond: { $eq: ['$$e.type', 'blocked'] }
            }
          }
        }
      ]
    }
  }
}

export async function normalizeCc(rawCc: RawCc): Promise<unknown> {
  const ccDecision = rawCc.metadatas

  /* 
    On annote uniquement les décisions qui sont "toBeTreated" car dans
    le cas d'une réception d'une mise a jour de décision qui ne nécessite
    pas un retraitement dans label il ne faut pas réannoter la décision.
  */
  if (ccDecision?.labelStatus === 'toBeTreated') {
    const annotatedDecision = await annotateDecision(ccDecision)
    return sendToSder(annotatedDecision)
  }

  return sendToSder(ccDecision)
}

export async function normalizeRawCcFiles(
  defaultFilter?: Parameters<typeof findFileInformations<RawCc>>[1]
) {
  logger.info({
    path: 'src/cc/handler.ts',
    operations: ['normalization', 'normalizeRawCcFiles'],
    message: `Starting CC normalization`
  })
  const _rawCcToNormalize = defaultFilter ?? rawCcToNormalize
  const rawCcCursor = await findFileInformations<RawCc>(COLLECTION_JURINET_RAW, _rawCcToNormalize)
  const rawCcLength = await countFileInformations<RawCc>(COLLECTION_JURINET_RAW, _rawCcToNormalize)
  logger.info({
    path: 'src/cc/handler.ts',
    operations: ['normalization', 'normalizeRawCcFiles'],
    message: `Find ${rawCcLength} raw decisions to normalize`
  })

  const results: NormalizationResult<RawCc>[] = await mapCursorSync(rawCcCursor, async (rawCc) => {
    try {
      logger.info({
        path: 'src/cc/handler.ts',
        operations: ['normalization', 'normalizeRawCcFiles'],
        message: `normalize ${rawCc._id} - ${rawCc.path}`
      })
      await normalizeCc(rawCc)
      logger.info({
        path: 'src/cc/handler.ts',
        operations: ['normalization', 'normalizeRawCcFiles'],
        message: `${rawCc._id} normalized with success`
      })
      return { rawFile: rawCc, status: 'success' }
    } catch (err) {
      const error = toUnexpectedError(err)
      logger.error({
        path: 'src/cc/handler.ts',
        operations: ['normalization', 'normalizeRawCcFiles'],
        message: `${rawCc._id} failed to normalize`,
        stack: error.stack
      })
      return { rawFile: rawCc, status: 'error', error }
    }
  })

  await Promise.all(results.map((_) => updateRawFileStatus(COLLECTION_JURINET_RAW, _)))

  logger.info({
    path: 'src/cc/handler.ts',
    operations: ['normalization', 'normalizeRawCcFiles'],
    message: `Decisions successfully normalized: ${
      results.filter(({ status }) => status === 'success').length
    }`
  })
  logger.info({
    path: 'src/cc/handler.ts',
    operations: ['normalization', 'normalizeRawCcFiles'],
    message: `Decisions skipped: ${results.filter(({ status }) => status === 'error').length}`
  })
}
