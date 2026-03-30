import { logger } from './config/logger'
import {
  ENV,
  BATCH_MAX_DECISIONS_CA,
  BATCH_MAX_DECISIONS_TJ,
  BATCH_MAX_DECISIONS_TCOM,
  BATCH_MAX_DECISIONS_CPH
} from './config/env'

import { normalizeRawCphFiles } from './sources/portalis/handler'
import { normalizationJob as normalizeRawTcomFiles } from './sources/juritcom/batch/normalization/normalization'
import { normalizeRawTjFiles } from './sources/juritj/batch/normalization/handler'
import { normalizeRawCcFiles } from './sources/jurinet/handler'
import { normalizeRawCaFiles } from './sources/jurica/handler'

const MAX_DECISION_PER_BATCH_CA = parseInt(BATCH_MAX_DECISIONS_CA, 10)
const MAX_DECISION_PER_BATCH_TJ = parseInt(BATCH_MAX_DECISIONS_TJ, 10)
const MAX_DECISION_PER_BATCH_TCOM = parseInt(BATCH_MAX_DECISIONS_TCOM, 10)
const MAX_DECISION_PER_BATCH_CPH = parseInt(BATCH_MAX_DECISIONS_CPH, 10)
const filters = undefined

async function startNormalization() {
  logger.info({
    path: 'src/batch.ts',
    operations: ['normalization', 'startNormalization']
  })
  await normalizeRawCcFiles()
  await normalizeRawCaFiles(filters, MAX_DECISION_PER_BATCH_CA)
  await normalizeRawTjFiles(filters, MAX_DECISION_PER_BATCH_TJ)
  await normalizeRawTcomFiles(MAX_DECISION_PER_BATCH_TCOM)
  if (['LOCAL', 'DEV', 'PREPROD'].includes(ENV))
    await normalizeRawCphFiles(filters, MAX_DECISION_PER_BATCH_CPH)
}

startNormalization()
