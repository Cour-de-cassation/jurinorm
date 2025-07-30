import {
  UnIdentifiedDecisionDila,
  UnIdentifiedDecision,
  parseUnIdentifiedDecision,
  Decision,
  DecisionDila,
  hasSourceNameDila,
  ParseError
} from 'dbsder-api-types'
import { ZoningParameters } from '../../library/zoning'
import { NotSupported, toNotSupported } from '../../library/error'

export type DecisionSupported = Exclude<Decision, DecisionDila> & {
  originalText: string // Warn: current model accept empty but new data doesn't
}

export type UnIdentifiedDecisionSupported = Exclude<
  UnIdentifiedDecision,
  UnIdentifiedDecisionDila
> & { originalText: string } /// Warn: current model accept empty but new data doesn't

function hasOriginalText(
  x: UnIdentifiedDecision
): x is UnIdentifiedDecision & { originalText: string } {
  return typeof x.originalText === 'string' && !!x.originalText
}

export function parseUnIdentifiedDecisionSupported(x: unknown): UnIdentifiedDecisionSupported {
  try {
    const decision = parseUnIdentifiedDecision(x)
    if (hasSourceNameDila(decision))
      throw new NotSupported('decision.sourceName', decision.sourceName)
    if (!hasOriginalText(decision))
      throw new NotSupported(
        'decision.originalText',
        decision.originalText,
        'originalText in decision is missing'
      )
    return decision
  } catch (err) {
    if (err instanceof ParseError) throw toNotSupported('decision', x, err)
    else throw err
  }
}

function mapDecisionIntoZoningSource(
  decision: UnIdentifiedDecisionSupported
): ZoningParameters['source'] {
  switch (decision.sourceName) {
    case 'jurica':
      return 'ca'
    case 'juritj':
      return 'tj'
    case 'jurinet':
      return 'cc'
    case 'juritcom':
      return 'tcom'
    case 'portalis-cph':
      // Warn: should be 'cph' but but does not yet exist in zoning API
      return 'ca'
  }
}

export function mapDecisionIntoZoningParameters(
  decision: UnIdentifiedDecisionSupported
): ZoningParameters {
  return {
    arret_id: decision.sourceId,
    source: mapDecisionIntoZoningSource(decision),
    text: decision.originalText
  }
}
