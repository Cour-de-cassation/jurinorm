import { DecisionS3Repository } from '../../../shared/infrastructure/repositories/decisionS3.repository'
import { InfrastructureExpection } from '../../../shared/infrastructure/exceptions/infrastructure.exception'
import { logger } from '../../../../connectors/logger'

export async function fetchDecisionListFromS3(
  repository: DecisionS3Repository,
  limit?: number
): Promise<string[]> {
  try {
    const rawDecisionList = await repository.getDecisionList(limit)
    return rawDecisionList.splice(0, rawDecisionList.length).map((decision) => decision.Key)
  } catch (error) {
    logger.error({
      path: 'src/tj/batch/normalization/services/fetchDecisionListFromS3.ts',
      operations: ['normalization', 'fetchDecisionListFromS3-TJ'],
      message: error.message,
      stack: error.stack
    })
    throw new InfrastructureExpection(error.message)
  }
}
