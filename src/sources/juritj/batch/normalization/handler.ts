import { toUnexpectedError } from '../../../../services/error'
import {
  countFileInformations,
  findFileInformations,
  mapCursorSync
} from '../../../../connectors/dbRawFile'
import { logger, TechLog } from '../../../../config/logger'
import { updateRawFileStatus, NormalizationResult } from '../../../../services/eventSourcing'
import { RawTj } from './models'
import { normalizeTj, rawTjToNormalize } from './normalization'

export async function normalizeRawTjFiles(
  defaultFilter?: Parameters<typeof findFileInformations<RawTj>>[1],
  limit?: number
) {
  const normalizationFormatLogs: TechLog = {
    path: 'src/sources/juritj/batch/normalization/handler.ts',
    operations: ['normalization', 'normalizeRawTjFiles']
  }

  logger.info({
    ...normalizationFormatLogs,
    message: `Starting TJ normalization`
  })
  const _rawTjToNormalize = defaultFilter ?? rawTjToNormalize
  const rawTjCursor = await findFileInformations<RawTj>(
    process.env.S3_BUCKET_NAME_RAW_TJ,
    _rawTjToNormalize,
    limit
  )
  const rawTjLength = await countFileInformations<RawTj>(
    process.env.S3_BUCKET_NAME_RAW_TJ,
    _rawTjToNormalize
  )
  logger.info({
    ...normalizationFormatLogs,
    message: `Find ${rawTjLength} raw decisions to normalize batch. Limit is set to ${limit}`
  })

  const results: NormalizationResult<RawTj>[] = await mapCursorSync(rawTjCursor, async (rawTj) => {
    try {
      // Log a passer en DecisionLog (problème dans les metadata de rawfils juritj, nous n'avons pas de sourceId => ??IdDecision??)
      logger.info({
        ...normalizationFormatLogs,
        message: `normalize ${rawTj._id} - ${rawTj.path}`
      })
      await normalizeTj(rawTj)
      logger.info({
        ...normalizationFormatLogs,
        message: `${rawTj._id} normalized with success`
      })

      const result = { rawFile: rawTj, status: 'success' } as const
      await updateRawFileStatus(process.env.S3_BUCKET_NAME_RAW_TJ, result)
      return result
    } catch (err) {
      const error = toUnexpectedError(err)
      logger.error({
        ...normalizationFormatLogs,
        message: `failed to normalize ${rawTj._id} raw file`,
        stack: error.stack
      })

      const result = { rawFile: rawTj, status: 'error', error } as const
      await updateRawFileStatus(process.env.S3_BUCKET_NAME_RAW_TJ, result)
      return result
    }
  })

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
