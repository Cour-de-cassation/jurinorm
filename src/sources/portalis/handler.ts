import { toUnexpectedError } from '../../services/error'
import { RawPortalis } from './models'
import {
  countFileInformations,
  findFileInformations,
  mapCursorSync
} from '../../connectors/dbRawFile'
import { normalizePortalis, rawPortalisToNormalize } from './normalization'
import { logger } from '../../config/logger'
import { S3_BUCKET_NAME_PORTALIS } from '../../config/env'
import { updateRawFileStatus, NormalizationResult } from '../../services/eventSourcing'

export async function normalizeRawPortalisFiles(
  defaultFilter?: Parameters<typeof findFileInformations<RawPortalis>>[1],
  limit?: number
) {
  logger.info({
    path: 'src/service/sources/portalis/handler.ts',
    operations: ['normalization', 'normalizeRawPortalisFiles'],
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
    path: 'src/service/sources/portalis/handler.ts',
    operations: ['normalization', 'normalizeRawPortalisFiles'],
    message: `Find ${rawPortalisLength} raw decisions to normalize batch. Limit is set to ${limit}`
  })

  const results: NormalizationResult<RawPortalis>[] = await mapCursorSync(
    rawPortalisCursor,
    async (rawPortalis) => {
      try {
        logger.info({
          path: 'src/service/sources/portalis/handler.ts',
          operations: ['normalization', 'normalizeRawPortalisFiles'],
          message: `normalize ${rawPortalis._id} - ${rawPortalis.path}`
        })
        await normalizePortalis(rawPortalis)
        logger.info({
          path: 'src/service/sources/portalis/handler.ts',
          operations: ['normalization', 'normalizeRawPortalisFiles'],
          message: `${rawPortalis._id} normalized with success`
        })

        const result = { rawFile: rawPortalis, status: 'success' } as const
        await updateRawFileStatus(S3_BUCKET_NAME_PORTALIS, result)
        return result
      } catch (err) {
        const error = toUnexpectedError(err)
        logger.error({
          path: 'src/service/sources/portalis/handler.ts',
          operations: ['normalization', 'normalizeRawPortalisFiles'],
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
    path: 'src/service/sources/portalis/handler.ts',
    operations: ['normalization', 'normalizeRawPortalisFiles'],
    message: `Decisions successfully normalized: ${
      results.filter(({ status }) => status === 'success').length
    }`
  })
  logger.info({
    path: 'src/service/sources/portalis/handler.ts',
    operations: ['normalization', 'normalizeRawPortalisFiles'],
    message: `Decisions skipped: ${results.filter(({ status }) => status === 'error').length}`
  })
}
