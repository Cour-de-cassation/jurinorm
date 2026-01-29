import { toUnexpectedError } from '../services/error'
import { RawCph } from './models'
import { countFileInformations, findFileInformations, mapCursorSync } from '../connectors/DbRawFile'
import { normalizeCph, rawCphToNormalize } from './normalization'
import { logger } from '../connectors/logger'
import { S3_BUCKET_NAME_PORTALIS } from '../connectors/env'
import { updateRawFileStatus, NormalizationResult } from '../services/eventSourcing'

export async function normalizeRawCphFiles(
  defaultFilter?: Parameters<typeof findFileInformations<RawCph>>[1],
  limit?: number
) {
  logger.info({
    path: 'src/service/cph/handler.ts',
    operations: ['normalization', 'normalizeRawCphFiles'],
    message: `Starting CPH normalization`
  })
  const _rawCphToNormalize = defaultFilter ?? rawCphToNormalize
  const rawCphCursor = await findFileInformations<RawCph>(
    S3_BUCKET_NAME_PORTALIS,
    _rawCphToNormalize,
    limit
  )
  const rawCphLength = await countFileInformations<RawCph>(
    S3_BUCKET_NAME_PORTALIS,
    _rawCphToNormalize
  )
  logger.info({
    path: 'src/service/cph/handler.ts',
    operations: ['normalization', 'normalizeRawCphFiles'],
    message: `Find ${rawCphLength} raw decisions to normalize batch. Limit is set to ${limit}`
  })

  const results: NormalizationResult<RawCph>[] = await mapCursorSync(
    rawCphCursor,
    async (rawCph) => {
      try {
        logger.info({
          path: 'src/service/cph/handler.ts',
          operations: ['normalization', 'normalizeRawCphFiles'],
          message: `normalize ${rawCph._id} - ${rawCph.path}`
        })
        await normalizeCph(rawCph)
        logger.info({
          path: 'src/service/cph/handler.ts',
          operations: ['normalization', 'normalizeRawCphFiles'],
          message: `${rawCph._id} normalized with success`
        })

        const result = { rawFile: rawCph, status: 'success' } as const
        await updateRawFileStatus(S3_BUCKET_NAME_PORTALIS, result)
        return result
      } catch (err) {
        const error = toUnexpectedError(err)
        logger.error({
          path: 'src/service/cph/handler.ts',
          operations: ['normalization', 'normalizeRawCphFiles'],
          message: `${rawCph._id} failed to normalize`,
          stack: error.stack
        })

        const result = { rawFile: rawCph, status: 'error', error } as const
        await updateRawFileStatus(S3_BUCKET_NAME_PORTALIS, result)
        return result
      }
    }
  )

  await Promise.all(results)

  logger.info({
    path: 'src/service/cph/handler.ts',
    operations: ['normalization', 'normalizeRawCphFiles'],
    message: `Decisions successfully normalized: ${
      results.filter(({ status }) => status === 'success').length
    }`
  })
  logger.info({
    path: 'src/service/cph/handler.ts',
    operations: ['normalization', 'normalizeRawCphFiles'],
    message: `Decisions skipped: ${results.filter(({ status }) => status === 'error').length}`
  })
}
