import { DecisionS3Repository } from '../../../shared/infrastructure/repositories/decisionS3.repository'
import { InfrastructureException } from '../../../shared/infrastructure/exceptions/infrastructure.exception'
import { logger, TechLog } from '../../../../../config/logger'
import { HttpStatus } from '@nestjs/common'

export async function fetchDecisionListFromS3(
  repository: DecisionS3Repository,
  limit?: number
): Promise<string[]> {
  try {
    const rawDecisionList = await repository.getDecisionList(limit)
    return rawDecisionList.splice(0, rawDecisionList.length).map((decision) => decision.Key)
  } catch (error) {
    const formatLogs: TechLog = {
      operations: ['normalization', 'fetchDecisionListFromS3'],
      path: 'src/sources/juritcom/batch/normalization/services/fetchDecisionListFromS3.ts',
      message: JSON.stringify({
        error: error.message,
        statusCode: HttpStatus.SERVICE_UNAVAILABLE
      })
    }
    logger.error(formatLogs)
    throw new InfrastructureException(error.message)
  }
}
