import { logger } from '../../library/logger'
import { CollectDto } from '../shared/infrastructure/dto/collect.dto'
import { DecisionS3Repository } from '../shared/infrastructure/repositories/decisionS3.repository'

async function main(key: string) {
  const s3Repository = new DecisionS3Repository()
  const t0 = new Date()
  const decision: CollectDto = await s3Repository.getNormalizedDecisionByFilename(key)
  const t1 = new Date()
  logger
  logger.info({
    path: 'src/tj/scripts/benchS3.ts',
    operations: ['other', 'script-benchS3-TJ'],
    message: `Got idDecision ${decision.metadonnees.idDecision} for file ${key} \nTook ${(
      (t1.getTime() - t0.getTime()) /
      1000
    ).toFixed(2)} seconds`
  })
}

main(process.argv[2])
