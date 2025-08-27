import { Queue, Job } from 'bullmq'
import Redis from 'ioredis'
import { UnIdentifiedDecisionSupported } from './decision/models'
import { logger } from '../library/logger'
import { REDIS_HOST, REDIS_PASSWORD, REDIS_DB } from '../library/env'

// Parse Redis host and port
const [host, portStr] = REDIS_HOST.split(':')

// Redis connection configuration
export const redisConfig = {
  host: host || 'localhost',
  port: portStr ? parseInt(portStr) : 6379,
  password: REDIS_PASSWORD || undefined,
  db: parseInt(REDIS_DB) || 0,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true
}

// Create Redis connection
export const redis = new Redis(redisConfig)

// Create decision normalization queue
export const decisionQueue = new Queue('decision-normalization', {
  connection: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
    attempts: 3, // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
})

// Queue job data interface
export type DecisionJobData = {
  decision: UnIdentifiedDecisionSupported
  timestamp: string
}

// Add decision to queue
export async function addDecisionToQueue(
  decision: UnIdentifiedDecisionSupported
): Promise<Job<DecisionJobData>> {
  try {
    const jobData: DecisionJobData = {
      decision,
      timestamp: new Date().toISOString()
    }

    const job = await decisionQueue.add('normalize-decision', jobData, {
      priority: 1,
      delay: 0
    })

    logger.info({
      type: 'decision',
      decision: { sourceId: decision.sourceId, sourceName: decision.sourceName },
      path: 'redis.ts addDecisionToQueue',
      msg: `Decision added to normalization queue with jobId: ${job.id}`
    })

    return job
  } catch (error) {
    logger.error({
      type: 'decision',
      decision: { sourceId: decision.sourceId, sourceName: decision.sourceName },
      path: 'redis.ts addDecisionToQueue',
      msg: `Failed to add decision to queue: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
    throw error
  }
}
