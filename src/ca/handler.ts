import { toUnexpectedError } from '../library/error'
import { RawCa } from './models'
import { countFileInformations, findFileInformations, mapCursorSync } from '../library/DbRawFile'
import { logger } from '../library/logger'
import { COLLECTION_JURICA_RAW } from '../library/env'
import { updateRawFileStatus, NormalizationResult } from '../services/eventSourcing'
import { sendToSder } from '../library/DbSder'
import { annotateDecision } from '../library/nlp/annotation'
import { LabelStatus } from 'dbsder-api-types'

const MAX_NUMBER_OF_DECISIONS_TO_RETRIEVE = 10

export const rawCaToNormalize = {
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

export async function normalizeCa(rawCa: RawCa): Promise<unknown> {
  const caDecision = rawCa.metadatas

  /* 
    On annote uniquement les décisions qui sont "toBeTreated" car dans
    le cas d'une réception d'une mise a jour de décision qui ne nécessite
    pas un retraitement dans label il ne faut pas réannoter la décision.
  */
  if (caDecision?.labelStatus === LabelStatus.TOBETREATED) {
    const annotatedDecision = await annotateDecision(caDecision)
    return sendToSder(annotatedDecision)
  }

  return sendToSder(caDecision)
}

export async function normalizeRawCaFiles(
  defaultFilter?: Parameters<typeof findFileInformations<RawCa>>[1]
) {
  logger.info({
    path: 'src/ca/handler.ts',
    operations: ['normalization', 'normalizeRawCaFiles'],
    message: `Starting CA normalization`
  })
  const _rawCaToNormalize = defaultFilter ?? rawCaToNormalize
  const rawCaCursor = await findFileInformations<RawCa>(
    COLLECTION_JURICA_RAW,
    _rawCaToNormalize,
    MAX_NUMBER_OF_DECISIONS_TO_RETRIEVE
  )
  const rawCaLength = await countFileInformations<RawCa>(COLLECTION_JURICA_RAW, _rawCaToNormalize)
  logger.info({
    path: 'src/ca/handler.ts',
    operations: ['normalization', 'normalizeRawCaFiles'],
    message: `Find ${rawCaLength} raw decisions to normalize, batch limit is set to ${MAX_NUMBER_OF_DECISIONS_TO_RETRIEVE}`
  })

  const results: NormalizationResult<RawCa>[] = await mapCursorSync(rawCaCursor, async (rawCa) => {
    try {
      logger.info({
        path: 'src/ca/handler.ts',
        operations: ['normalization', 'normalizeRawCaFiles'],
        message: `normalize ${rawCa._id} - ${rawCa.path}`
      })
      await normalizeCa(rawCa)
      logger.info({
        path: 'src/ca/handler.ts',
        operations: ['normalization', 'normalizeRawCaFiles'],
        message: `${rawCa._id} normalized with success`
      })
      return { rawFile: rawCa, status: 'success' }
    } catch (err) {
      const error = toUnexpectedError(err)
      logger.error({
        path: 'src/ca/handler.ts',
        operations: ['normalization', 'normalizeRawCaFiles'],
        message: `${rawCa._id} failed to normalize`,
        stack: error.stack
      })
      return { rawFile: rawCa, status: 'error', error }
    }
  })

  await Promise.all(results.map((_) => updateRawFileStatus(COLLECTION_JURICA_RAW, _)))

  logger.info({
    path: 'src/ca/handler.ts',
    operations: ['normalization', 'normalizeRawCaFiles'],
    message: `Decisions successfully normalized: ${
      results.filter(({ status }) => status === 'success').length
    }`
  })
  logger.info({
    path: 'src/ca/handler.ts',
    operations: ['normalization', 'normalizeRawCaFiles'],
    message: `Decisions skipped: ${results.filter(({ status }) => status === 'error').length}`
  })
}
