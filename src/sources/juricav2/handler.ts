import { toUnexpectedError } from '../../services/error'
import { RawJurica } from './models'
import {
  countFileInformations,
  findFileInformations,
  mapCursorSync
} from '../../connectors/dbRawFile'
import { normalizeJurica, rawJuricaToNormalize } from './normalization'
import { DecisionLog, logger, TechLog } from '../../config/logger'
import { COLLECTION_JURICAV2_RAW } from '../../config/env'
import { updateRawFileStatus, NormalizationResult } from '../../services/eventSourcing'

export async function normalizeRawJuricaFiles(
  defaultFilter?: Parameters<typeof findFileInformations<RawJurica>>[1],
  limit?: number
) {
  const normalizationFormatLogs: TechLog = {
    path: 'src/sources/juricav2/handler.ts',
    operations: ['normalization', 'normalizeRawJuricaFiles']
  }
  logger.info({
    ...normalizationFormatLogs,
    message: `Starting Jurica normalization`
  })
  const rawJuricaFilter = defaultFilter ?? rawJuricaToNormalize
  const rawJuricaCursor = await findFileInformations<RawJurica>(
    COLLECTION_JURICAV2_RAW,
    rawJuricaFilter,
    limit
  )
  const rawJuricaLength = await countFileInformations<RawJurica>(
    COLLECTION_JURICAV2_RAW,
    rawJuricaFilter
  )
  logger.info({
    ...normalizationFormatLogs,
    message: `Find ${rawJuricaLength} raw decisions to normalize batch. Limit is set to ${limit}`
  })

  const results: NormalizationResult<RawJurica>[] = await mapCursorSync(
    rawJuricaCursor,
    async (rawJurica) => {
      const normalizationFormatDecisionLogs: DecisionLog = {
        path: 'src/sources/juricav2/handler.ts',
        operations: ['normalization', 'normalizeRawJuricaFiles'],
        decision: {
          _id: rawJurica._id.toJSON(),
          sourceId: rawJurica.metadatas._id.toHexString(),
          sourceName: 'Jurica'
        }
      }
      try {
        logger.info({
          ...normalizationFormatDecisionLogs,
          message: `Starting normalization for ${rawJurica._id} - ${rawJurica.path}`
        })
        await normalizeJurica(rawJurica)
        logger.info({
          ...normalizationFormatDecisionLogs,
          message: `${rawJurica._id} normalized with success`
        })

        const result = { rawFile: rawJurica, status: 'success' } as const
        await updateRawFileStatus(COLLECTION_JURICAV2_RAW, result)
        return result
      } catch (err) {
        const error = toUnexpectedError(err)
        logger.error({
          ...normalizationFormatDecisionLogs,
          message: `${rawJurica._id} failed to normalize`,
          stack: error.stack
        })

        const result = { rawFile: rawJurica, status: 'error', error } as const
        await updateRawFileStatus(COLLECTION_JURICAV2_RAW, result)
        return result
      }
    }
  )

  await Promise.all(results)

  logger.info({
    ...normalizationFormatLogs,
    message: `Decisions successfully normalized: ${
      results.filter(({ status }) => status === 'success').length
    }`
  })
  logger.info({
    ...normalizationFormatLogs,
    message: `Decisions skipped: ${results.filter(({ status }) => status === 'error').length}`
  })
}
