import { toUnexpectedError } from '../../../library/error'
import { RawCph } from './models'
import {
  countFileInformations,
  findFileInformations,
  mapCursorSync
} from '../../../library/DbRawFile'
import { normalizeCph, rawCphToNormalize } from './normalization'
import { logger } from '../../../library/logger'
import { S3_BUCKET_NAME_PORTALIS } from '../../../library/env'
import { updateRawFileStatus, NormalizationResult } from '../../../services/eventSourcing'

export async function normalizeRawCphFiles(
  defaultFilter?: Parameters<typeof findFileInformations<RawCph>>[1]
) {
  logger.info({
    path: 'src/service/cph/handler.ts',
    operations: ['normalization', 'normalizeRawCphFiles'],
    message: `Starting CPH normalization`
  })
  const _rawCphToNormalize = defaultFilter ?? rawCphToNormalize
  const rawCphCursor = await findFileInformations<RawCph>(
    S3_BUCKET_NAME_PORTALIS,
    _rawCphToNormalize
  )
  const rawCphLength = await countFileInformations<RawCph>(
    S3_BUCKET_NAME_PORTALIS,
    _rawCphToNormalize
  )
  logger.info({
    path: 'src/service/cph/handler.ts',
    operations: ['normalization', 'normalizeRawCphFiles'],
    message: `Find ${rawCphLength} raw decisions to normalize`
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
        return { rawFile: rawCph, status: 'success' }
      } catch (err) {
        const error = toUnexpectedError(err)
        logger.error({
          path: 'src/service/cph/handler.ts',
          operations: ['normalization', 'normalizeRawCphFiles'],
          message: `${rawCph._id} failed to normalize`,
          stack: error.stack
        })
        return { rawFile: rawCph, status: 'error', error }
      }
    }
  )

  await Promise.all(results.map((_) => updateRawFileStatus(S3_BUCKET_NAME_PORTALIS, _)))

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
