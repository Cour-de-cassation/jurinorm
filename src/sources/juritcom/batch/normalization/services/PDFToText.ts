import { DecisionS3Repository } from '../../../shared/infrastructure/repositories/decisionS3.repository'
import { InfrastructureException } from '../../../shared/infrastructure/exceptions/infrastructure.exception'
import { logger } from '../../../../../config/logger'

export interface NLPPDFToTextDTO {
  markdownText?: string
  HTMLText?: string
  images?: object
  versions?: object
}

export async function fetchPDFFromS3(
  s3Repository: DecisionS3Repository,
  pdfFilename: string
): Promise<Buffer> {
  try {
    return await s3Repository.getPDFByFilename(pdfFilename)
  } catch (error) {
    logger.error({
      operations: ['normalization', 'fetchPDFFromS3'],
      path: 'src/sources/juritcom/batch/normalization/services/PDFToText.ts',
      message: error.message
    })
    throw new InfrastructureException(error.message)
  }
}

