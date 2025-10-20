import { UnIdentifiedDecisionCc } from 'dbsder-api-types'
import { RawFile } from '../services/eventSourcing'

export type RawCa = RawFile<UnIdentifiedDecisionCc>

export type NormalizationSucess = {
  rawCph: RawCa
  status: 'success'
}

export type NormalizationError = {
  rawCph: RawCa
  status: 'error'
  error: Error
}

export type NormalizationResult = NormalizationError | NormalizationSucess
