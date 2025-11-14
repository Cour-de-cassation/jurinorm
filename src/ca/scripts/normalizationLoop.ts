import { countFileInformations } from '../../library/DbRawFile'
import { normalizeRawCaFiles } from '../handler'
import { COLLECTION_JURICA_RAW } from '../../library/env'
import { logger } from '../../library/logger'
import { RawCa } from '../models'
import { Filter } from 'mongodb'

export async function runNormalizationLoop(filter?: Filter<RawCa>) {
  let remainingCount = await countFileInformations<RawCa>(COLLECTION_JURICA_RAW, filter)

  logger.info({
    path: 'src/ca/scripts/normalizationLoop.ts',
    operations: ['other', 'runNormalizationLoop'],
    message: `Starting normalization loop with ${remainingCount} decisions to process`
  })

  while (remainingCount > 0) {
    logger.info({
      path: 'src/ca/scripts/normalizationLoop.ts',
      operations: ['other', 'runNormalizationLoop'],
      message: `Processing batch, ${remainingCount} decisions remaining`
    })

    await normalizeRawCaFiles(filter)

    remainingCount = await countFileInformations<RawCa>(COLLECTION_JURICA_RAW, filter)
  }

  logger.info({
    path: 'src/ca/scripts/normalizationLoop.ts',
    operations: ['other', 'runNormalizationLoop'],
    message: `Normalization loop completed, no more decisions to process`
  })
}
