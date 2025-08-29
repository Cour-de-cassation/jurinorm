import { Worker, Job } from 'bullmq'
import { DecisionJobData, redisConfig } from '../library/redis'
import { logger } from '../library/logger'
import { normalizeDecision } from './normalization'

// Create worker to process decision normalization jobs
export const decisionWorker = new Worker(
  'decision-normalization',
  async (job: Job<DecisionJobData>) => {
    const { decision } = job.data

    logger.info({
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

      logger.info({
        type: 'decision',
        decision: { sourceId: decision.sourceId, sourceName: decision.sourceName },
        path: 'decisionNormalizationWorker.ts decisionWorker',
        msg: `Decision processing completed successfully for jobId: ${job.id}`
      })

      return result
    } catch (error) {
      throw error // Trigger retry, error is logged in the event handler below
    }
  },
  {
    connection: redisConfig,
    concurrency: 1
  }
)

// Worker event handlers
decisionWorker.on('completed', (job) => {
  const { decision } = job.data
  logger.info({
    type: 'decision',
    decision: { sourceId: decision.sourceId, sourceName: decision.sourceName },
    path: 'decisionNormalizationWorker.ts on:completed',
    msg: `Job ${job.id} completed successfully`
  })
})

decisionWorker.on('failed', (job, err) => {
  const decision = job?.data?.decision
  logger.error({
    type: 'decision',
    decision: decision
      ? { sourceId: decision.sourceId, sourceName: decision.sourceName }
      : undefined,
    path: 'decisionNormalizationWorker.ts on:failed',
    msg: `Job ${job?.id} failed: ${err.message}`
  })
})

decisionWorker.on('error', (err) => {
  logger.error({
    type: 'tech',
    path: 'decisionNormalizationWorker.ts on:error',
    msg: err.message
  })
})
