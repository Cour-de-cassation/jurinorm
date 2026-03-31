import { UnIdentifiedDecisionTj, SuiviOccultation } from 'dbsder-api-types'
import { logger } from '../../../../../config/logger'

export function computeOccultation(
  recommandationOccultation: string,
  occultationSupplementaire: string,
  debatPublic: boolean
): UnIdentifiedDecisionTj['occultation'] {
  const additionalTerms =
    recommandationOccultation === SuiviOccultation.SUBSTITUANT ||
    recommandationOccultation === SuiviOccultation.COMPLEMENT
      ? occultationSupplementaire
      : ''

  logger.info({
    path: 'src/tj/batch/normalization/services/computeOccultation.ts',
    operations: ['normalization', 'computeOccultation-TJ'],
    message: `additionalTerms computed`
  })

  const motivationOccultation =
    recommandationOccultation === SuiviOccultation.AUCUNE ||
    recommandationOccultation === SuiviOccultation.SUBSTITUANT
      ? false
      : !debatPublic

  logger.info({
    path: 'src/tj/batch/normalization/services/computeOccultation.ts',
    operations: ['normalization', 'computeOccultation-TJ'],
    message: `motivationOccultation computed ${motivationOccultation}`
  })

  return {
    additionalTerms,
    categoriesToOmit: [],
    motivationOccultation
  }
}
