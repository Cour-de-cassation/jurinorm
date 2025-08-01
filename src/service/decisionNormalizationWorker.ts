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
      type: 'decision',
      decision: { sourceId: decision.sourceId, sourceName: decision.sourceName },
      path: 'decisionNormalizationWorker.ts decisionWorker',
      msg: `Processing decision normalization job with jobId: ${job.id}`
    })

    try {
      // Process the decision using the business logic service
      const result = await normalizeDecision(decision)

      if (!result.success) {
        throw new Error(result.error || 'Processing failed')
      }

      logger.info('Decision processing completed successfully', {
        type: 'decision',
        decision: { sourceId: decision.sourceId, sourceName: decision.sourceName },
        path: 'decisionNormalizationWorker.ts decisionWorker',
        msg: `Decision processing completed successfully for jobId: ${job.id}`
      })

      return result
    } catch (error) {
      logger.error('Failed to process decision', {
        type: 'decision',
        decision: { sourceId: decision.sourceId, sourceName: decision.sourceName },
        path: 'decisionNormalizationWorker.ts decisionWorker',
        msg: error instanceof Error ? error.message : 'Unknown error'
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
    type: 'tech',
    path: 'decisionNormalizationWorker.ts on:completed',
    msg: `Job ${job.id} completed successfully`
  })
})

decisionWorker.on('failed', (job, err) => {
  logger.error('Job failed', {
    type: 'tech',
    path: 'decisionNormalizationWorker.ts on:failed',
    msg: `Job ${job?.id} failed: ${err.message}`
  })
})

decisionWorker.on('error', (err) => {
  logger.error('Worker error', {
    type: 'tech',
    path: 'decisionNormalizationWorker.ts on:error',
    msg: err.message
  })
})
