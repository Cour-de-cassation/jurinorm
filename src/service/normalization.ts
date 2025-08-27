import { UnIdentifiedDecisionSupported } from './decision/models'
import { fetchZoning } from '../library/zoning'
import { putDecision } from '../library/dbsderApi'
import { mapDecisionIntoZoningParameters } from './decision/models'
import { logger } from '../library/logger'
import { hasSourceNameTj } from 'dbsder-api-types'
import { computeRulesDecisionTj } from './rules/rulesTj'

export type ProcessingResult = {
  success: boolean
  decisionSourceId: number
  timestamp: string
  error?: string
}

const callZoningAPI = async (decision: UnIdentifiedDecisionSupported) => {
  logger.info({
    type: 'decision',
    decision: { sourceId: decision.sourceId, sourceName: decision.sourceName },
    path: 'normalization.ts callZoningAPI',
    msg: 'Calling zoning API'
  })

  const zoningParams = mapDecisionIntoZoningParameters(decision)
  return await fetchZoning(zoningParams)
}

export const normalizeDecision = async (
  decision: UnIdentifiedDecisionSupported
): Promise<ProcessingResult> => {
  try {
    logger.info({
      type: 'decision',
      decision: { sourceId: decision.sourceId, sourceName: decision.sourceName },
      path: 'normalization.ts normalizeDecision',
      msg: 'Starting decision processing'
    })

    // Step 1: Call zoning API
    const zoningResult = await callZoningAPI(decision)
    decision.originalTextZoning = zoningResult

    // Step 2: Apply filtering rules
    const decisionWithRules = hasSourceNameTj(decision)
      ? await computeRulesDecisionTj(decision)
      : decision

    // Step 3: Save to DBSDER API
    await putDecision(decisionWithRules)

    return {
      success: true,
      decisionSourceId: decision.sourceId,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    logger.error({
      type: 'decision',
      decision: { sourceId: decision.sourceId, sourceName: decision.sourceName },
      path: 'normalization.ts normalizeDecision',
      msg: error instanceof Error ? error.message : 'Unknown error'
    })

    return {
      success: false,
      decisionSourceId: decision.sourceId,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
