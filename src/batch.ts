import { logger } from './connectors/logger'
import { ENV } from './connectors/env'

import { normalizeRawCphFiles } from './cph/handler'
import { normalizationJob as normalizeRawTcomFiles } from './tcom/batch/normalization/normalization'
import { normalizeRawTjFiles } from './tj/batch/normalization/handler'
import { normalizeRawCcFiles } from './cc/handler'
import { normalizeRawCaFiles } from './ca/handler'

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
