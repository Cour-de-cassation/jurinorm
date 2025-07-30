import { UnIdentifiedDecisionSupported } from './decision/models'
import { fetchZoning } from '../library/zoning'
import { putDecision } from '../library/dbsderApi'
import { mapDecisionIntoZoningParameters } from './decision/models'
import { logger } from '../library/logger'

export type ProcessingResult = {
  success: boolean
  decisionSourceId: number
  timestamp: string
  error?: string
}

const callZoningAPI = async (decision: UnIdentifiedDecisionSupported) => {
  logger.info('Calling zoning API', {
    decisionSourceId: decision.sourceId
  })

  const zoningParams = mapDecisionIntoZoningParameters(decision)
  return await fetchZoning(zoningParams)
}

const applyFilteringRules = async (decision: UnIdentifiedDecisionSupported) => {
  logger.info('Applying filtering rules', {
    decisionSourceId: decision.sourceId
  })

  // TODO: Implement your filtering rules here
  // This is where you migrate the filtering logic from dbsder-api

  return decision
}

export const normalizeDecision = async (
  decision: UnIdentifiedDecisionSupported
): Promise<ProcessingResult> => {
  try {
    logger.info('Starting decision processing', {
      decisionSourceId: decision.sourceId,
      sourceName: decision.sourceName
    })

    // Step 1: Call zoning API
    const zoningResult = await callZoningAPI(decision)
    decision.originalTextZoning = zoningResult

    // Step 2: Apply filtering rules
    const filteredDecision = await applyFilteringRules(decision)

    // Step 3: Save to DBSDER API
    await putDecision(filteredDecision)

    return {
      success: true,
      decisionSourceId: decision.sourceId,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    logger.error('Decision processing failed', {
      decisionSourceId: decision.sourceId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return {
      success: false,
      decisionSourceId: decision.sourceId,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
