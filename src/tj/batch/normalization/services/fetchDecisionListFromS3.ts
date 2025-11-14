import { DecisionS3Repository } from '../../../shared/infrastructure/repositories/decisionS3.repository'
import { InfrastructureExpection } from '../../../shared/infrastructure/exceptions/infrastructure.exception'
import { logger } from '../../../../library/logger'

const MAX_NUMBER_OF_DECISIONS_TO_RETRIEVE = 10

export async function fetchDecisionListFromS3(repository: DecisionS3Repository): Promise<string[]> {
  try {
    const rawDecisionList = await repository.getDecisionList(MAX_NUMBER_OF_DECISIONS_TO_RETRIEVE)
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
