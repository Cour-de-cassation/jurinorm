import { CronJob } from 'cron'
import { logger } from './config/logger'
import { ENV, NORMALIZATION_BATCH_SCHEDULE } from './config/env'

import { normalizeRawCphFiles } from './sources/portalis/handler'
import { normalizationJob as normalizeRawTcomFiles } from './sources/juritcom/batch/normalization/normalization'
import { normalizeRawTjFiles } from './sources/juritj/batch/normalization/handler'
import { normalizeRawCcFiles } from './sources/jurinet/handler'
import { normalizeRawCaFiles } from './sources/jurica/handler'

import { assertQueues, startNlpDoneConsumer } from './connectors/nlpQueues'
import { closeAmqpConnection } from './connectors/amqp'

const CRON_EVERY_HOUR = '0 * * * *'

// TODO: reset batch size, changed for testing purposes
const MAX_DECISION_PER_BATCH = 1
const MAX_DECISION_PER_BATCH_TCOM = 1
const MAX_DECISION_PER_BATCH_TJ = 3
const filters = undefined

async function startNormalization() {
  CronJob.from({
    cronTime: NORMALIZATION_BATCH_SCHEDULE ?? CRON_EVERY_HOUR,
    async onTick() {
      logger.info({
        path: 'src/batch.ts',
        operations: ['normalization', 'startNormalization']
      })
      await normalizeRawCcFiles()
      await normalizeRawCaFiles(filters, MAX_DECISION_PER_BATCH)
      await normalizeRawTjFiles(filters, MAX_DECISION_PER_BATCH_TJ)
      await normalizeRawTcomFiles(MAX_DECISION_PER_BATCH_TCOM)
      if (['LOCAL', 'DEV', 'PREPROD'].includes(ENV))
        await normalizeRawCphFiles(filters, MAX_DECISION_PER_BATCH)
    },
    waitForCompletion: true, // onTick cannot be retry if an instance of it is running
    timeZone: 'Europe/Paris',
    runOnInit: true, // This attribute is set to launch the normalization batch once at the start of the cronjob
    start: true // This attribute starts the cron job after its instantiation (equivalent to cron.start())
  })
}

// Create queues and start consumer for NLP results
function buildErrorsArray(err): string[] {
  return err instanceof AggregateError
  ? err.errors.map((e: Error) => e.message)
  : [err.message]
}

assertQueues()
  .then(() => {
    startNlpDoneConsumer().catch((err) => {
      const errors = buildErrorsArray(err)
      logger.warn({
        path: 'src/batch.ts',
        operations: ['normalization', 'startNlpDoneConsumer'],
        message: `Failed to start consumer for nlp.done: ${errors.join(', ')}`
      })
    })
  })
  .catch((err) => {
    const errors = buildErrorsArray(err)
    logger.warn({
      path: 'src/batch.ts',
      operations: ['normalization', 'assertQueues'],
      message: `Failed to assert queues: ${errors.join(', ')}`
    })
})

// Graceful shutdown to avoid open connections to RabbitMQ + potential message loss
async function shutdown(signal: string) {
  logger.info({
    path: 'src/batch.ts',
    operations: ['normalization', 'shutdown'],
    message: `${signal} received, closing RabbitMQ connection`
  })

  try {
    await closeAmqpConnection()
  } catch (err) {
    logger.warn({
      path: 'src/batch.ts',
      operations: ['normalization', 'shutdown'],
      message: `Failed to close RabbitMQ connection: ${err.message}`
    })
  } finally {
    process.exit(0)
  }
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

startNormalization()