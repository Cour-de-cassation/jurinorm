import { UnIdentifiedDecisionCc } from 'dbsder-api-types'
import { RawFile } from '../services/eventSourcing'

export type RawCc = RawFile<UnIdentifiedDecisionCc>

export type NormalizationSucess = {
  rawCph: RawCc
  status: 'success'
}

export type NormalizationError = {
  rawCph: RawCc
  status: 'error'
  error: Error
}

export type NormalizationResult = NormalizationError | NormalizationSucess
