import { UnIdentifiedDecisionTcom, LabelStatus } from 'dbsder-api-types'
import { LogsFormat } from '../../../shared/infrastructure/utils/logsFormat.utils'
// import { authorizedJurisdictions } from '../infrastructure/authorizedJurisdictionsList'
import { ZoningApiService } from './zoningApi.service'
import { logger } from '../../../../library/logger'

const dateMiseEnService = getMiseEnServiceDate()
// const authorizedJurisdictionsSet = new Set(authorizedJurisdictions)

export async function computeLabelStatus(
  decisionDto: UnIdentifiedDecisionTcom
): Promise<LabelStatus> {
  const dateCreation = new Date(decisionDto.dateCreation)
  const dateDecision = new Date(decisionDto.dateDecision)
  const zoningApiService: ZoningApiService = new ZoningApiService()

  if (decisionDto.debatPublic === false && decisionDto.public === false) {
    logger.error({
      path: 'src/tcom/batch/normalization/services/computeLabelStatus',
      operations: ['normalization', 'computeLabelStatus-TCOM'],
      message: `${decisionDto.jurisdictionId}-${decisionDto.jurisdictionName}: Decision debates are not public. Changing LabelStatus to ${LabelStatus.IGNORED_DEBAT_NON_PUBLIC}.`,
    })
    return LabelStatus.IGNORED_DEBAT_NON_PUBLIC
  }

  if (decisionDto.public === false) {
    logger.error({
      path: 'src/tcom/batch/normalization/services/computeLabelStatus',
      operations: ['normalization', 'computeLabelStatus-TCOM'],
      message: `${decisionDto.jurisdictionId}-${decisionDto.jurisdictionName}: Decision is not public. Changing LabelStatus to ${LabelStatus.IGNORED_DECISION_NON_PUBLIQUE}.`,
    })
    return LabelStatus.IGNORED_DECISION_NON_PUBLIQUE
  }

  try {
    const decisionZoning: UnIdentifiedDecisionTcom['zoning'] =
      await zoningApiService.getDecisionZoning(decisionDto)
    decisionDto.originalTextZoning = decisionZoning
    if (decisionZoning.is_public === 0) {
      logger.error({
        path: 'src/tcom/batch/normalization/services/computeLabelStatus',
        operations: ['normalization', 'computeLabelStatus-TCOM'],
        message: `${decisionDto.jurisdictionId}-${decisionDto.jurisdictionName}: Decision is not public *according to Zoning*. Changing LabelStatus to ${LabelStatus.IGNORED_DECISION_NON_PUBLIQUE}.`,
      })
      return LabelStatus.IGNORED_DECISION_NON_PUBLIQUE
    }
    if (decisionZoning.is_public === 2) {
      logger.error({
        path: 'src/tcom/batch/normalization/services/computeLabelStatus',
        operations: ['normalization', 'computeLabelStatus-TCOM'],
        message: `${decisionDto.jurisdictionId}-${decisionDto.jurisdictionName}: Decision debates are not public *according to Zoning*. Changing LabelStatus to ${LabelStatus.IGNORED_DEBAT_NON_PUBLIC}.`,
      })
      return LabelStatus.IGNORED_DEBAT_NON_PUBLIC
    }
  } catch (error) {
    logger.error({
      path: 'src/tcom/batch/normalization/services/computeLabelStatus',
      operations: ['normalization', 'computeLabelStatus-TCOM'],
      message: `Error while calling zoning.`,
      stack: error.stack
    })
  }

  if (isDecisionInTheFuture(dateCreation, dateDecision)) {
    logger.error({
      path: 'src/tcom/batch/normalization/services/computeLabelStatus',
      operations: ['normalization', 'computeLabelStatus-TCOM'],
      message: `${decisionDto.jurisdictionId}-${decisionDto.jurisdictionName}: Incorrect date, dateDecision must be before dateCreation. Changing LabelStatus to ${LabelStatus.IGNORED_DATE_DECISION_INCOHERENTE}.`,
    })
    return LabelStatus.IGNORED_DATE_DECISION_INCOHERENTE
  }

  if (isDecisionOlderThanMiseEnService(dateDecision)) {
    logger.error({
      path: 'src/tcom/batch/normalization/services/computeLabelStatus',
      operations: ['normalization', 'computeLabelStatus-TCOM'],
      message: `${decisionDto.jurisdictionId}-${decisionDto.jurisdictionName}: Incorrect date, dateDecision must be after mise en service. Changing LabelStatus to ${LabelStatus.IGNORED_DATE_AVANT_MISE_EN_SERVICE}.`,
    })
    return LabelStatus.IGNORED_DATE_AVANT_MISE_EN_SERVICE
  }

  /*
  if (isDecisionJurisdictionNotInWhiteList(decisionDto.jurisdictionId)) {
    logger.error({
      ...formatLogs,
      msg: `Jurisdiction ${decisionDto.jurisdictionId} in testing phase. Changing LabelStatus to ${LabelStatus.IGNORED_JURIDICTION_EN_PHASE_DE_TEST}.`,
      idJuridiction: decisionDto.jurisdictionId,
      libelleJuridiction: decisionDto.jurisdictionName
    })
    return LabelStatus.IGNORED_JURIDICTION_EN_PHASE_DE_TEST
  }
  */

  return decisionDto.labelStatus
}

function isDecisionInTheFuture(dateCreation: Date, dateDecision: Date): boolean {
  return dateDecision > dateCreation
}

function isDecisionOlderThanMiseEnService(dateDecision: Date): boolean {
  return dateDecision < dateMiseEnService
}

/*
function isDecisionJurisdictionNotInWhiteList(jurisdictionId: string): boolean {
  return !authorizedJurisdictionsSet.has(jurisdictionId)
}
*/

function getMiseEnServiceDate(): Date {
  if (!isNaN(new Date(process.env.COMMISSIONING_DATE_TCOM).getTime())) {
    return new Date(process.env.COMMISSIONING_DATE_TCOM)
  } else {
    return new Date('2024-12-31')
  }
}
