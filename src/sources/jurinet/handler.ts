import {
  countFileInformations,
  findFileInformations,
  mapCursorSync
} from '../../connectors/dbRawFile'
import { toUnexpectedError } from '../../services/error'
import { RawCc } from './models'
import { logger, TechLog } from '../../config/logger'
import { COLLECTION_JURINET_RAW } from '../../config/env'
import { updateRawFileStatus, NormalizationResult } from '../../services/eventSourcing'
import { annotateDecision } from '../../services/rules/annotation'
import { LabelStatus } from 'dbsder-api-types'
import { saveDecisionInAffaire } from '../../services/affaire'

export const rawCcToNormalize = {
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
      }
    ]
  }
}

export async function normalizeCc(rawCc: RawCc): Promise<NormalizationResult<RawCc>> {
  const ccDecision = rawCc.metadatas

  /*
    Ce code est temporaire. Il est nécessaire car la normalisation des décisions
    CC est encore réalisée dans openjustice-sder. Une fois que toute la normalisation
    sera réalisée dans jurinorm ce code pourra être supprimé
  */
  const { sourceId } = ccDecision
  const candidateToNewReception = await findFileInformations<RawCc>(COLLECTION_JURINET_RAW, {
    'metadatas.sourceId': sourceId,
    _id: { $ne: rawCc._id }
  }).then((_) => _.toArray())

  const hasNewReception = candidateToNewReception.some(
    (currentRaw) => currentRaw.events[0].date > rawCc.events[0].date
  )
  if (hasNewReception) {
    logger.info({
      path: 'src/sources/jurinet/handler.ts',
      operations: ['normalization', 'normalizeCc'],
      message: `rawCc ${rawCc._id} marked as deleted because new reception`
    })
    return { status: 'deleted', rawFile: rawCc }
  }
  // Fin de code temporaire

  /* 
    On annote uniquement les décisions qui sont "toBeTreated" car dans
    le cas d'une réception d'une mise a jour de décision qui ne nécessite
    pas un retraitement dans label il ne faut pas réannoter la décision.
  */
  if (
    ccDecision?.labelStatus === LabelStatus.TOBETREATED ||
    ccDecision?.labelStatus === LabelStatus.WAITING_FOR_AFFAIRE_RESOLUTION
  ) {
    const annotatedDecision = await annotateDecision(ccDecision)
    await saveDecisionInAffaire(annotatedDecision)
    return { status: 'success', rawFile: rawCc }
  }

  await saveDecisionInAffaire(ccDecision)
  return { status: 'success', rawFile: rawCc }
}

export async function normalizeRawCcFiles(
  defaultFilter?: Parameters<typeof findFileInformations<RawCc>>[1]
) {
  const normalizationFormatLogs: TechLog = {
    path: 'src/sources/jurinet/handler.ts',
    operations: ['normalization', 'normalizeRawCcFiles'],
  }
  logger.info({
    ...normalizationFormatLogs,
    message: `Starting CC normalization`
  })
  const _rawCcToNormalize = defaultFilter ?? rawCcToNormalize
  const rawCcCursor = await findFileInformations<RawCc>(COLLECTION_JURINET_RAW, _rawCcToNormalize)
  const rawCcLength = await countFileInformations<RawCc>(COLLECTION_JURINET_RAW, _rawCcToNormalize)
  logger.info({
    ...normalizationFormatLogs,
    message: `Find ${rawCcLength} raw decisions to normalize`
  })

  const results: NormalizationResult<RawCc>[] = await mapCursorSync(rawCcCursor, async (rawCc) => {
    try {
      logger.info({
        ...normalizationFormatLogs,
        message: `normalize ${rawCc._id} - ${rawCc.path}`
      })
      const result = await normalizeCc(rawCc)
      logger.info({
        ...normalizationFormatLogs,
        message: `${rawCc._id} normalized with success`
      })

      await updateRawFileStatus(COLLECTION_JURINET_RAW, result)
      return result
    } catch (err) {
      const error = toUnexpectedError(err)
      logger.error({
        ...normalizationFormatLogs,
        message: `${rawCc._id} failed to normalize`,
        stack: error.stack
      })

      const result = { rawFile: rawCc, status: 'error', error } as const
      await updateRawFileStatus(COLLECTION_JURINET_RAW, result)
      return result
    }
  })

  await Promise.all(results)

  logger.info({
    ...normalizationFormatLogs,
    message: `Decisions successfully normalized: ${results.filter(({ status }) => status === 'success').length
      }`
  })
  logger.info({
    ...normalizationFormatLogs,
    message: `Decisions skipped: ${results.filter(({ status }) => status === 'error').length}`
  })
  logger.info({
    ...normalizationFormatLogs,
    message: `Decisions marked as deleted: ${results.filter(({ status }) => status === 'deleted').length
      }`
  })
}
