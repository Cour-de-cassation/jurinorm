import { LabelStatus, parseId } from 'dbsder-api-types'
import {
  createAffaire,
  createDecision,
  patchDecision,
  UnIdentifiedDecisionSupported
} from '../connectors/DbSder'

export async function saveDecisionInAffaire(
  decision: UnIdentifiedDecisionSupported
): Promise<unknown> {
  const { labelStatus, ...tmpDecision } = decision

  const { _id } = await createDecision({
    labelStatus: LabelStatus.WAITING_FOR_AFFAIRE_RESOLUTION,
    ...tmpDecision
  })

  const decisionId = parseId(_id)

  await createAffaire({
    decisionIds: [decisionId],
    documentAssocieIds: [],
    replacementTerms: []
  })
  return patchDecision(decisionId, {
    labelStatus
  })
}
