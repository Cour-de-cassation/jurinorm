import { UnIdentifiedDecisionTcom, LabelStatus } from 'dbsder-api-types'
import { LogsFormat } from '../../../shared/infrastructure/utils/logsFormat.utils'
// import { authorizedJurisdictions } from '../infrastructure/authorizedJurisdictionsList'
import { ZoningApiService } from './zoningApi.service'
import { logger, normalizationFormatLogs } from '../logger'

const dateMiseEnService = getMiseEnServiceDate()
// const authorizedJurisdictionsSet = new Set(authorizedJurisdictions)

export async function computeLabelStatus(
  decisionDto: UnIdentifiedDecisionTcom
): Promise<LabelStatus> {
  const dateCreation = new Date(decisionDto.dateCreation)
  const dateDecision = new Date(decisionDto.dateDecision)
  const zoningApiService: ZoningApiService = new ZoningApiService()

  const formatLogs: LogsFormat = {
    ...normalizationFormatLogs,
    operationName: 'computeLabelStatus',
    msg: 'Starting computeLabelStatus...'
  }

  if (decisionDto.debatPublic === false && decisionDto.public === false) {
    logger.error({
      ...formatLogs,
      msg: `Decision debates are not public. Changing LabelStatus to ${LabelStatus.IGNORED_DEBAT_NON_PUBLIC}.`,
      idJuridiction: decisionDto.jurisdictionId,
      libelleJuridiction: decisionDto.jurisdictionName
    })
    return LabelStatus.IGNORED_DEBAT_NON_PUBLIC
  }

  if (decisionDto.public === false) {
    logger.error({
      ...formatLogs,
      msg: `Decision is not public. Changing LabelStatus to ${LabelStatus.IGNORED_DECISION_NON_PUBLIQUE}.`,
      idJuridiction: decisionDto.jurisdictionId,
      libelleJuridiction: decisionDto.jurisdictionName
    })
    return LabelStatus.IGNORED_DECISION_NON_PUBLIQUE
  }

  try {
    const decisionZoning: UnIdentifiedDecisionTcom['zoning'] =
      await zoningApiService.getDecisionZoning(decisionDto)
    decisionDto.originalTextZoning = decisionZoning
    if (decisionZoning.is_public === 0) {
      logger.error({
        ...formatLogs,
        msg: `Decision is not public *according to Zoning*. Changing LabelStatus to ${LabelStatus.IGNORED_DECISION_NON_PUBLIQUE}.`,
        idJuridiction: decisionDto.jurisdictionId,
        libelleJuridiction: decisionDto.jurisdictionName
      })
      return LabelStatus.IGNORED_DECISION_NON_PUBLIQUE
    }
    if (decisionZoning.is_public === 2) {
      logger.error({
        ...formatLogs,
        msg: `Decision debates are not public *according to Zoning*. Changing LabelStatus to ${LabelStatus.IGNORED_DEBAT_NON_PUBLIC}.`,
        idJuridiction: decisionDto.jurisdictionId,
        libelleJuridiction: decisionDto.jurisdictionName
      })
      return LabelStatus.IGNORED_DEBAT_NON_PUBLIC
    }
  } catch (error) {
    logger.error({
      ...formatLogs,
      msg: `Error while calling zoning.`,
      data: error
    })
  }

  if (isDecisionInTheFuture(dateCreation, dateDecision)) {
    logger.error({
      ...formatLogs,
      msg: `Incorrect date, dateDecision must be before dateCreation. Changing LabelStatus to ${LabelStatus.IGNORED_DATE_DECISION_INCOHERENTE}.`,
      idJuridiction: decisionDto.jurisdictionId,
      libelleJuridiction: decisionDto.jurisdictionName
    })
    return LabelStatus.IGNORED_DATE_DECISION_INCOHERENTE
  }

  if (isDecisionOlderThanMiseEnService(dateDecision)) {
    logger.error({
      ...formatLogs,
      msg: `Incorrect date, dateDecision must be after mise en service. Changing LabelStatus to ${LabelStatus.IGNORED_DATE_AVANT_MISE_EN_SERVICE}.`,
      idJuridiction: decisionDto.jurisdictionId,
      libelleJuridiction: decisionDto.jurisdictionName
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
  if (!isNaN(new Date(process.env.COMMISSIONING_DATE).getTime())) {
    return new Date(process.env.COMMISSIONING_DATE)
  } else {
    return new Date('2024-12-31')
  }
}
