import { UnIdentifiedDecisionTcom, LabelStatus } from 'dbsder-api-types'
import { logger, TechLog } from '../../../../../config/logger'

const dateMiseEnService = getMiseEnServiceDate()

export async function computeLabelStatus(
  decisionDto: UnIdentifiedDecisionTcom
): Promise<LabelStatus> {
  const dateCreation = new Date(decisionDto.dateCreation)
  const dateDecision = new Date(decisionDto.dateDecision)

  const formatLogs: TechLog = {
    operations: ['normalization', 'computeLabelStatus'],
    path: 'src/sources/juritcom/batch/normalization/services/computeLabelStatus.ts'
  }
  logger.info({
    ...formatLogs,
    message: `Starting computeLabelStatus for decision ${decisionDto.sourceId} from ${decisionDto.jurisdictionName}`
  })

  if (isDecisionInTheFuture(dateCreation, dateDecision)) {
    logger.error({
      ...formatLogs,
      message: `Incorrect date, dateDecision is in the future compared to dateCreation for idJuridiction  ${decisionDto.jurisdictionId} & libelleJuridiction  ${decisionDto.jurisdictionName}. Changing LabelStatus to ${LabelStatus.IGNORED_DATE_DECISION_INCOHERENTE}.`
    })
    return LabelStatus.IGNORED_DATE_DECISION_INCOHERENTE
  }

  if (isDecisionOlderThanMiseEnService(dateDecision)) {
    logger.error({
      ...formatLogs,
      message: `Incorrect date, dateDecision is before mise en service date for idJuridiction  ${decisionDto.jurisdictionId} & libelleJuridiction  ${decisionDto.jurisdictionName}. Changing LabelStatus to ${LabelStatus.IGNORED_DATE_AVANT_MISE_EN_SERVICE}.`
    })
    return LabelStatus.IGNORED_DATE_AVANT_MISE_EN_SERVICE
  }

  if (decisionDto.public === false) {
    logger.error({
      ...formatLogs,
      message: `Decision is not public for idJuridiction  ${decisionDto.jurisdictionId} & libelleJuridiction  ${decisionDto.jurisdictionName}. Changing LabelStatus to ${LabelStatus.IGNORED_DECISION_NON_PUBLIQUE}.`
    })
    return LabelStatus.IGNORED_DECISION_NON_PUBLIQUE
  }

  if (decisionDto.motifsSecretAffaires === true) {
    logger.error({
      ...formatLogs,
      message: `Decision has motifs secret affaires for idJuridiction  ${decisionDto.jurisdictionId} & libelleJuridiction  ${decisionDto.jurisdictionName}. Changing LabelStatus to ${LabelStatus.IGNORED_MOTIFS_SECRET_AFFAIRE}.`
    })
    return LabelStatus.IGNORED_MOTIFS_SECRET_AFFAIRE
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
