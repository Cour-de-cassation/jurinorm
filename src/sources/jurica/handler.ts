import { toUnexpectedError } from '../../services/error'
import { RawCa } from './models'
import {
  countFileInformations,
  findFileInformations,
  mapCursorSync
} from '../../connectors/dbRawFile'
import { logger } from '../../config/logger'
import { COLLECTION_JURICA_RAW } from '../../config/env'
import { updateRawFileStatus, NormalizationResult } from '../../services/eventSourcing'
import { /*annotateDecision,*/ computeCategories } from '../../services/rules/annotation'
import { LabelStatus } from 'dbsder-api-types'
import { saveDecisionInAffaire } from '../../services/affaire'
import { UnIdentifiedDecisionSupported } from '../../connectors/dbSder'
import { computeRaisonInteretParticulier } from '../../services/rules/raisonInteretParticulier'
import { publishToNer } from '../../../src/connectors/nlpQueues'

export const rawCaToNormalize = {
  // Ne contient pas deleted:
  events: { $not: { $elemMatch: { type: 'deleted' } } },
  $expr: {
    $and: [
      // Le dernier event n'est pas "normalized":
      {
        $not: {
          $eq: [{ $arrayElemAt: ['$events.type', -1] }, 'normalized']
        }
      },
      // Les 3 derniers events ne sont pas "blocked":
      {
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
      },
      // Le dernier event n'est pas "nlpPending":
      {
        $not: {
          $eq: [{ $arrayElemAt: ['$events.type', -1] }, 'nlpPending']
        }
      }
    ]
  }
}

export async function normalizeCa(rawCa: RawCa): Promise<NormalizationResult<RawCa>> {
  const decisionMetadata = rawCa.metadatas

  const raisonInteretParticulier = computeRaisonInteretParticulier(
    decisionMetadata.selection,
    decisionMetadata.sommaire
  )
  const caDecision = { ...decisionMetadata, raisonInteretParticulier }
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
    // const annotatedDecision = await annotateDecision(caDecision)
    // return saveDecisionInAffaire(annotatedDecision)

    await publishToNer({
      rawId: rawCa._id.toString(),
      rawCollection: COLLECTION_JURICA_RAW,
      decision: caDecision,
      sourceId: caDecision.sourceId,
      sourceName: caDecision.sourceName,
      parties: caDecision.parties,
      text: caDecision.originalText,
      categories: computeCategories(caDecision.occultation.categoriesToOmit),
      additionalTerms: caDecision.occultation.additionalTerms
    })

    return { status: 'nlpPending', rawFile: rawCa }
  }

  await saveDecisionInAffaire(caDecision as UnIdentifiedDecisionSupported)

  return { status: 'success', rawFile: rawCa }
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
      const result = await normalizeCa(rawCa)
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
