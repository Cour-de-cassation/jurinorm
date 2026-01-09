import { UnIdentifiedDecisionTcom, LabelStatus } from 'dbsder-api-types'
import { LogsFormat } from '../../../shared/infrastructure/utils/logsFormat.utils'
import { logger, normalizationFormatLogs } from '../logger'

const dateMiseEnService = getMiseEnServiceDate()

export async function computeLabelStatus(
  decisionDto: UnIdentifiedDecisionTcom
): Promise<LabelStatus> {
  const dateCreation = new Date(decisionDto.dateCreation)
  const dateDecision = new Date(decisionDto.dateDecision)

  const formatLogs: LogsFormat = {
    ...normalizationFormatLogs,
    operationName: 'computeLabelStatus',
    msg: 'Starting computeLabelStatus...'
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

  if (decisionDto.public === false) {
    logger.error({
      ...formatLogs,
      msg: `Decision is not public. Changing LabelStatus to ${LabelStatus.IGNORED_DECISION_NON_PUBLIQUE}.`,
      idJuridiction: decisionDto.jurisdictionId,
      libelleJuridiction: decisionDto.jurisdictionName
    })
    return LabelStatus.IGNORED_DECISION_NON_PUBLIQUE
  }

  if (decisionDto.debatPublic === false) {
    logger.error({
      ...formatLogs,
      msg: `Decision debates are not public. Changing LabelStatus to ${LabelStatus.IGNORED_DEBAT_NON_PUBLIC}.`,
      idJuridiction: decisionDto.jurisdictionId,
      libelleJuridiction: decisionDto.jurisdictionName
    })
    return LabelStatus.IGNORED_DEBAT_NON_PUBLIC
  }

  return decisionDto.labelStatus
}

function isDecisionInTheFuture(dateCreation: Date, dateDecision: Date): boolean {
  return dateDecision > dateCreation
}

function isDecisionOlderThanMiseEnService(dateDecision: Date): boolean {
  return dateDecision < dateMiseEnService
}

function getMiseEnServiceDate(): Date {
  if (!isNaN(new Date(process.env.COMMISSIONING_DATE_TCOM).getTime())) {
    return new Date(process.env.COMMISSIONING_DATE_TCOM)
  } else {
    return new Date('2024-12-31')
  }
}
