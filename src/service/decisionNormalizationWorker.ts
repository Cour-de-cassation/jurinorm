import { Worker, Job } from 'bullmq'
import { DecisionJobData, redisConfig } from './redis'
import { logger } from '../library/logger'
import { normalizeDecision } from './normalization'

// Create worker to process decision normalization jobs
export const decisionWorker = new Worker(
  'decision-normalization',
  async (job: Job<DecisionJobData>) => {
    const { decision } = job.data

    logger.info('Processing decision normalization job', {
      jobId: job.id,
      decisionSourceId: decision.sourceId,
      sourceName: decision.sourceName
    })

    try {
      // Process the decision using the business logic service
      const result = await normalizeDecision(decision)

      if (!result.success) {
        throw new Error(result.error || 'Processing failed')
      }

      logger.info('Decision processing completed successfully', {
        jobId: job.id,
        decisionSourceId: decision.sourceId
      })

      return result
    } catch (error) {
      logger.error('Failed to process decision', {
        jobId: job.id,
        decisionSourceId: decision.sourceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error // This will mark the job as failed and trigger retries
    }
  },
  {
    connection: redisConfig,
    concurrency: 1
  }
)

// Worker event handlers
decisionWorker.on('completed', (job) => {
  logger.info('Job completed', {
    jobId: job.id,
    returnValue: job.returnvalue
  })
})

decisionWorker.on('failed', (job, err) => {
  logger.error('Job failed', {
    jobId: job?.id,
    error: err.message
  })
})

decisionWorker.on('error', (err) => {
  logger.error('Worker error', { error: err.message })
})
