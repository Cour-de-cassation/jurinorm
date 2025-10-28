import { toUnexpectedError } from '../library/error'
import { RawCa } from './models'
import { countFileInformations, findFileInformations, mapCursorSync } from '../library/DbRawFile'
import { logger } from '../library/logger'
import { COLLECTION_JURICA_RAW } from '../library/env'
import { updateRawFileStatus, NormalizationResult } from '../services/eventSourcing'
import { sendToSder } from '../library/DbSder'
import { annotateDecision } from '../library/nlp/annotation'

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

  const annotatedDecision = await annotateDecision(caDecision)

  return sendToSder(annotatedDecision)
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
  const rawCaCursor = await findFileInformations<RawCa>(COLLECTION_JURICA_RAW, _rawCaToNormalize)
  const rawCaLength = await countFileInformations<RawCa>(COLLECTION_JURICA_RAW, _rawCaToNormalize)
  logger.info({
    path: 'src/ca/handler.ts',
    operations: ['normalization', 'normalizeRawCaFiles'],
    message: `Find ${rawCaLength} raw decisions to normalize`
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
