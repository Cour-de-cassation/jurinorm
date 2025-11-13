import { CronJob } from 'cron'
import { logger } from './library/logger'
import { ENV, NORMALIZATION_BATCH_SCHEDULE } from './library/env'

// import { normalizeRawCphFiles } from './cph/service/cph/handler'
// import { normalizationJob as normalizeRawTcomFiles } from './tcom/batch/normalization/normalization'
// import { normalizationJob as normalizeRawTjFiles } from './tj/batch/normalization/normalization'
import { normalizeRawCcFiles } from './cc/handler'
// import { normalizeRawCaFiles } from './ca/handler'

const CRON_EVERY_HOUR = '0 * * * *'

async function startNormalization() {
  CronJob.from({
    cronTime: NORMALIZATION_BATCH_SCHEDULE ?? CRON_EVERY_HOUR,
    async onTick() {
      logger.info({
        path: 'src/batch.ts',
        operations: ['normalization', 'startNormalization']
      })
      await normalizeRawCcFiles()
      // await normalizeRawCaFiles()
      // await normalizeRawTjFiles()
      // await normalizeRawTcomFiles()
      // if (['LOCAL', 'DEV', 'PREPROD'].includes(ENV)) await normalizeRawCphFiles()
    },
    waitForCompletion: true, // onTick cannot be retry if an instance of it is running
    timeZone: 'Europe/Paris',
    runOnInit: true, // This attribute is set to launch the normalization batch once at the start of the cronjob
    start: true // This attribute starts the cron job after its instantiation (equivalent to cron.start())
  })
}

startNormalization()
