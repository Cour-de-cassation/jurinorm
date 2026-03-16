import { logger } from './config/logger'
import { ENV } from './config/env'

import { normalizeRawCphFiles } from './sources/portalis/handler'
import { normalizationJob as normalizeRawTcomFiles } from './sources/juritcom/batch/normalization/normalization'
import { normalizeRawTjFiles } from './sources/juritj/batch/normalization/handler'
import { normalizeRawCcFiles } from './sources/jurinet/handler'
import { normalizeRawCaFiles } from './sources/jurica/handler'

const MAX_DECISION_PER_BATCH = 10
const filters = undefined

async function startNormalization() {
  logger.info({
    path: 'src/batch.ts',
    operations: ['normalization', 'startNormalization']
  })
  await normalizeRawCcFiles()
  await normalizeRawCaFiles(filters, MAX_DECISION_PER_BATCH)
  await normalizeRawTjFiles(filters, MAX_DECISION_PER_BATCH)
  await normalizeRawTcomFiles(MAX_DECISION_PER_BATCH)
  if (['LOCAL', 'DEV', 'PREPROD'].includes(ENV))
    await normalizeRawCphFiles(filters, MAX_DECISION_PER_BATCH)
}

startNormalization()
