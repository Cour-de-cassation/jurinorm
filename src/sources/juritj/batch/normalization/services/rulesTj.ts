import { DbSderApiGateway } from '../repositories/gateways/dbsderApi.gateway'
import {
  CategoriesToOmit,
  CodeNac,
  LabelStatus,
  SuiviOccultation,
  UnIdentifiedDecisionTj
} from 'dbsder-api-types'

const dbSderApiGateway = new DbSderApiGateway()

export function occultationRecommendationCodeNac(
  recommandationOccultation: SuiviOccultation
): CategoriesToOmit {
  if (
    recommandationOccultation === SuiviOccultation.COMPLEMENT ||
    recommandationOccultation === SuiviOccultation.CONFORME
  ) {
    return CategoriesToOmit.SUIVI
  } else {
    return CategoriesToOmit.NON_SUIVI
  }
}

export async function computeRulesDecisionTj(
  decision: UnIdentifiedDecisionTj,
  originalTextZoning: UnIdentifiedDecisionTj['originalTextZoning']
): Promise<UnIdentifiedDecisionTj> {
  if (!decision.public)
    return {
      ...decision,
      labelStatus: LabelStatus.IGNORED_DECISION_NON_PUBLIQUE
    }
  if (originalTextZoning?.is_public === 0)
    return {
      ...decision,
      labelStatus: LabelStatus.IGNORED_DECISION_NON_PUBLIQUE_PAR_ZONAGE
    }
  if (decision.debatPublic && originalTextZoning?.is_public === 2)
    return {
      ...decision,
      labelStatus: LabelStatus.IGNORED_DECISION_PARTIELLEMENT_PUBLIQUE_PAR_ZONAGE
    }

  const codeNac: CodeNac = await dbSderApiGateway.getCodeNac(decision.NACCode)

  if (!codeNac) return { ...decision, labelStatus: LabelStatus.IGNORED_CODE_NAC_INCONNU }
  if (codeNac.decisionsPubliques !== 'décisions publiques')
    return {
      ...decision,
      labelStatus: LabelStatus.IGNORED_CODE_NAC_DECISION_NON_PUBLIQUE
    }
  if (!codeNac.categoriesToOmit || !codeNac.blocOccultation)
    return {
      ...decision,
      labelStatus: LabelStatus.IGNORED_BLOC_OCCULATION_NON_DEFINI
    }
  if (decision.debatPublic && codeNac.debatsPublics !== 'débats publics')
    return {
      ...decision,
      labelStatus: LabelStatus.IGNORED_CODE_NAC_DECISION_PARTIELLEMENT_PUBLIQUE
    }

  const recommandationOccultationForNac = occultationRecommendationCodeNac(
    decision.recommandationOccultation
  )
  const occultation = {
    ...decision.occultation,
    categoriesToOmit: codeNac.categoriesToOmit[recommandationOccultationForNac]
  }
  const blocOccultation = codeNac.blocOccultation

  return {
    ...decision,
    occultation,
    blocOccultation
  }
}
