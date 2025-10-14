import { countRawInformations, findRawInformations, mapCursorSync } from '../../library/DbRaw'
import { logger } from '../../library/logger'
import { toUnexpectedError } from '../../library/error'
import { S3_BUCKET_NAME_PORTALIS } from '../../library/env'
import { NormalizationResult, updateRawStatus } from '../../service/eventSourcing'

import { RawCph } from './models'
import { normalizeCph, rawCphToNormalize } from './normalization'

export async function normalizeRawCph(
  defaultFilter?: Parameters<typeof findRawInformations<RawCph>>[1]
) {
  logger.info({
    path: 'src/cph/service/handler.ts',
    operations: ['normalization', 'normalizeRawCph'],
    message: `Starting CPH normalization`
  })
  const _rawCphToNormalize = defaultFilter ?? rawCphToNormalize
  const rawCphCursor = await findRawInformations<RawCph>(
    S3_BUCKET_NAME_PORTALIS,
    _rawCphToNormalize
  )
  const rawCphLength = await countRawInformations<RawCph>(
    S3_BUCKET_NAME_PORTALIS,
    _rawCphToNormalize
  )
  logger.info({
    path: 'src/cph/service/handler.ts',
    operations: ['normalization', 'normalizeRawCph'],
    message: `Find ${rawCphLength} raw decisions to normalize`
  })

  const results: NormalizationResult<RawCph>[] = await mapCursorSync(
    rawCphCursor,
    async (rawCph) => {
      try {
        logger.info({
          path: 'src/cph/service/handler.ts',
          operations: ['normalization', 'normalizeRawCph'],
          message: `normalize ${rawCph._id} - ${rawCph.path}`
        })
        await normalizeCph(rawCph)
        logger.info({
          path: 'src/cph/service/handler.ts',
          operations: ['normalization', 'normalizeRawCph'],
          message: `${rawCph._id} normalized with success`
        })
        return { rawDecision: rawCph, status: 'success' }
      } catch (err) {
        const error = toUnexpectedError(err)
        logger.error({
          path: 'src/cph/service/handler.ts',
          operations: ['normalization', 'normalizeRawCph'],
          message: `${rawCph._id} failed to normalize`,
          stack: error.stack
        })
        return { rawDecision: rawCph, status: 'error', error }
      }
    }
  )

  await Promise.all(results.map((_) => updateRawStatus(S3_BUCKET_NAME_PORTALIS, _)))

  logger.info({
    path: 'src/cph/service/handler.ts',
    operations: ['normalization', 'normalizeRawCph'],
    message: `Decisions successfully normalized: ${
      results.filter(({ status }) => status === 'success').length
    }`
  })
  logger.info({
    path: 'src/cph/service/handler.ts',
    operations: ['normalization', 'normalizeRawCph'],
    message: `Decisions skipped: ${results.filter(({ status }) => status === 'error').length}`
  })
}
