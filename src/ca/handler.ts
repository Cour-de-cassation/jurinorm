import { toUnexpectedError } from '../services/error'
import { RawCa } from './models'
import { countFileInformations, findFileInformations, mapCursorSync } from '../connectors/DbRawFile'
import { logger } from '../connectors/logger'
import { COLLECTION_JURICA_RAW } from '../connectors/env'
import { updateRawFileStatus, NormalizationResult } from '../services/eventSourcing'
import { annotateDecision } from '../services/nlp/annotation'
import { LabelStatus } from 'dbsder-api-types'
import { saveDecisionInAffaire } from '../services/affaire'

export const rawCaToNormalize = {
  // Ne contient ni normalized ni deleted:
  events: { $not: { $elemMatch: { type: { $in: ['normalized', 'deleted'] } } } },
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
    Ce code est temporaire. Il est nécessaire car la normalisation des décisions
    CA est encore réalisée dans openjustice-sder. Une fois que toute la normalisation
    sera réalisée dans jurinorm ce code pourra être supprimé
  */
  const { sourceId } = caDecision
  const candidateToNewReception = await findFileInformations<RawCa>(COLLECTION_JURICA_RAW, {
    'metadatas.sourceId': sourceId,
    _id: { $ne: rawCa._id }
  }).then((_) => _.toArray())

  const hasNewReception = candidateToNewReception.some(
    (currentRaw) => currentRaw.events[0].date > rawCa.events[0].date
  )
  if (hasNewReception) {
    logger.info({
      path: 'src/ca/handler.ts',
      operations: ['normalization', 'normalizeCa'],
      message: `rawCa ${rawCa._id} marked as deleted because new reception`
    })
    return { status: 'deleted', rawFile: rawCa }
  }
  // Fin de code temporaire

  /* 
    On annote uniquement les décisions qui sont "toBeTreated" car dans
    le cas d'une réception d'une mise a jour de décision qui ne nécessite
    pas un retraitement dans label il ne faut pas réannoter la décision.
  */
  if (
    caDecision?.labelStatus === LabelStatus.TOBETREATED || 
    caDecision?.labelStatus === LabelStatus.WAITING_FOR_AFFAIRE_RESOLUTION
  ) {
    const annotatedDecision = await annotateDecision(caDecision)
    return saveDecisionInAffaire(annotatedDecision)
  }

  return saveDecisionInAffaire(caDecision)
}

export async function normalizeRawCaFiles(
  defaultFilter?: Parameters<typeof findFileInformations<RawCa>>[1],
  limit?: number
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
    limit
  )
  const rawCaLength = await countFileInformations<RawCa>(COLLECTION_JURICA_RAW, _rawCaToNormalize)
  logger.info({
    path: 'src/ca/handler.ts',
    operations: ['normalization', 'normalizeRawCaFiles'],
    message: `Find ${rawCaLength} raw decisions to normalize. Limit is set to ${limit}`
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

      const result = { rawFile: rawCa, status: 'success' } as const
      await updateRawFileStatus(COLLECTION_JURICA_RAW, result)
      return result
    } catch (err) {
      const error = toUnexpectedError(err)
      logger.error({
        path: 'src/ca/handler.ts',
        operations: ['normalization', 'normalizeRawCaFiles'],
        message: `${rawCa._id} failed to normalize`,
        stack: error.stack
      })

      const result = { rawFile: rawCa, status: 'error', error } as const
      await updateRawFileStatus(COLLECTION_JURICA_RAW, result)
      return result
    }
  })

  await Promise.all(results)

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
  logger.info({
    path: 'src/ca/handler.ts',
    operations: ['normalization', 'normalizeRawCaFiles'],
    message: `Decisions marked as deleted: ${
      results.filter(({ status }) => status === 'deleted').length
    }`
  })
}
