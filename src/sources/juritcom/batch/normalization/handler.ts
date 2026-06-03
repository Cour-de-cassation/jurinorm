import { toUnexpectedError } from '../../../../services/error'
import {
  countFileInformations,
  findFileInformations,
  mapCursorSync
} from '../../../../connectors/dbRawFile'
import { logger, TechLog } from '../../../../config/logger'
import { updateRawFileStatus, NormalizationResult } from '../../../../services/eventSourcing'
import { RawTcom } from '../../shared/infrastructure/dto/rawFile'
import { normalizeTcom, rawTcomToNormalize } from './normalization'

export async function normalizeRawTcomFiles(
  defaultFilter?: Parameters<typeof findFileInformations<RawTcom>>[1],
  limit?: number
) {
  const normalizationFormatLogs: TechLog = {
    path: 'src/sources/juritcom/batch/normalization/handler.ts',
    operations: ['normalization', 'normalizeRawTcomFiles']
  }

  logger.info({
    ...normalizationFormatLogs,
    message: `Starting TCOM normalization`
  })
  const _rawTcomToNormalize = defaultFilter ?? rawTcomToNormalize
  const RawTcomCursor = await findFileInformations<RawTcom>(
    process.env.S3_BUCKET_NAME_PDF,
    _rawTcomToNormalize,
    limit
  )
  const rawTcomLength = await countFileInformations<RawTcom>(
    process.env.S3_BUCKET_NAME_PDF,
    _rawTcomToNormalize
  )
  logger.info({
    ...normalizationFormatLogs,
    message: `Find ${rawTcomLength} raw decisions to normalize batch. Limit is set to ${limit}`
  })

  const results: NormalizationResult<RawTcom>[] = await mapCursorSync(
    RawTcomCursor,
    async (rawTcom) => {
      try {
        logger.info({
          ...normalizationFormatLogs,
          message: `normalize ${rawTcom._id} - ${rawTcom.path}`
        })
        await normalizeTcom(rawTcom)
        logger.info({
          ...normalizationFormatLogs,
          message: `${rawTcom._id} normalized with success`
        })

        const result = { rawFile: rawTcom, status: 'success' } as const
        await updateRawFileStatus(process.env.S3_BUCKET_NAME_PDF, result)
        return result
      } catch (err) {
        const error = toUnexpectedError(err)
        logger.error({
          ...normalizationFormatLogs,
          message: `failed to normalize ${rawTcom._id} raw file`,
          stack: error.stack
        })

        const result = { rawFile: rawTcom, status: 'error', error } as const
        await updateRawFileStatus(process.env.S3_BUCKET_NAME_PDF, result)
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
