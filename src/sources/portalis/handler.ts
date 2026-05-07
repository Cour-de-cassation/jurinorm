import { toUnexpectedError } from '@services/error'
import { RawPortalis } from './models'
import {
  countFileInformations,
  findFileInformations,
  mapCursorSync
} from '../../connectors/dbRawFile'
import { normalizePortalis, rawPortalisToNormalize } from './normalization'
import { DecisionLog, logger, TechLog } from '../../config/logger'
import { S3_BUCKET_NAME_PORTALIS } from '../../config/env'
import { updateRawFileStatus, NormalizationResult } from '../../services/eventSourcing'

export async function normalizeRawPortalisFiles(
  defaultFilter?: Parameters<typeof findFileInformations<RawPortalis>>[1],
  limit?: number
) {
  const normalizationFormatLogs: TechLog = {
    path: 'src/sources/portalis/handler.ts',
    operations: ['normalization', 'normalizeRawPortalisFiles']
  }
  logger.info({
    ...normalizationFormatLogs,
    message: `Starting Portalis normalization`
  })
  const rawPortalisFilter = defaultFilter ?? rawPortalisToNormalize
  const rawPortalisCursor = await findFileInformations<RawPortalis>(
    S3_BUCKET_NAME_PORTALIS,
    rawPortalisFilter,
    limit
  )
  const rawPortalisLength = await countFileInformations<RawPortalis>(
    S3_BUCKET_NAME_PORTALIS,
    rawPortalisFilter
  )
  logger.info({
    ...normalizationFormatLogs,
    message: `Find ${rawPortalisLength} raw decisions to normalize batch. Limit is set to ${limit}`
  })

  const results: NormalizationResult<RawPortalis>[] = await mapCursorSync(
    rawPortalisCursor,
    async (rawPortalis) => {
      const normalizationFormatDecisionLogs: DecisionLog = {
        path: 'src/sources/portalis/handler.ts',
        operations: ['normalization', 'normalizeRawPortalisFiles'],
        decision: {
          _id: rawPortalis._id.toJSON(),
          sourceId: rawPortalis.metadatas.identifiantDecision,
          sourceName: 'Portalis'
        }
      }
      try {
        logger.info({
          ...normalizationFormatDecisionLogs,
          message: `Starting normalization for ${rawPortalis._id} - ${rawPortalis.path}`
        })
        await normalizePortalis(rawPortalis)
        logger.info({
          ...normalizationFormatDecisionLogs,
          message: `${rawPortalis._id} normalized with success`
        })

        const result = { rawFile: rawPortalis, status: 'success' } as const
        await updateRawFileStatus(S3_BUCKET_NAME_PORTALIS, result)
        return result
      } catch (err) {
        const error = toUnexpectedError(err)
        logger.error({
          ...normalizationFormatDecisionLogs,
          message: `${rawPortalis._id} failed to normalize`,
          stack: error.stack
        })

        const result = { rawFile: rawPortalis, status: 'error', error } as const
        await updateRawFileStatus(S3_BUCKET_NAME_PORTALIS, result)
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
