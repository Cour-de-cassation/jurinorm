import { toUnexpectedError } from '../../../services/error'
import {
  countFileInformations,
  findFileInformations,
  mapCursorSync
} from '../../../connectors/DbRawFile'
import { logger } from '../../../connectors/logger'
import { updateRawFileStatus, NormalizationResult } from '../../../services/eventSourcing'
import { RawTj } from './models'
import { normalizeTj, rawTjToNormalize } from './normalization'

export async function normalizeRawTjFiles(
  defaultFilter?: Parameters<typeof findFileInformations<RawTj>>[1],
  limit?: number
) {
  logger.info({
    path: 'src/tj/batch/normalization/handler.ts',
    operations: ['normalization', 'normalizeRawTjFiles'],
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
    path: 'src/tj/batch/normalization/handler.ts',
    operations: ['normalization', 'normalizeRawTJFiles'],
    message: `Find ${rawTjLength} raw decisions to normalize batch. Limit is set to ${limit}`
  })

  const results: NormalizationResult<RawTj>[] = await mapCursorSync(rawTjCursor, async (rawTj) => {
    try {
      logger.info({
        path: 'src/tj/batch/normalization/handler.ts',
        operations: ['normalization', 'normalizeRawTjFiles'],
        message: `normalize ${rawTj._id} - ${rawTj.path}`
      })
      await normalizeTj(rawTj)
      logger.info({
        path: 'src/tj/batch/normalization/handler.ts',
        operations: ['normalization', 'normalizeRawTjFiles'],
        message: `${rawTj._id} normalized with success`
      })

      const result = { rawFile: rawTj, status: 'success' } as const
      await updateRawFileStatus(process.env.S3_BUCKET_NAME_RAW_TJ, result)
      return result
    } catch (err) {
      const error = toUnexpectedError(err)
      logger.error({
        path: 'src/tj/batch/normalization/handler.ts',
        operations: ['normalization', 'normalizeRawTjFiles'],
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
    path: 'src/tj/batch/normalization/handler.ts',
    operations: ['normalization', 'normalizeRawTjFiles'],
    message: `Decisions successfully normalized: ${
      results.filter(({ status }) => status === 'success').length
    }`
  })
  logger.info({
    path: 'src/tj/batch/normalization/handler.ts',
    operations: ['normalization', 'normalizeRawTjFiles'],
    message: `Decisions skipped: ${results.filter(({ status }) => status === 'error').length}`
  })
}
