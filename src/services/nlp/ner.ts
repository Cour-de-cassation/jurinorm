import axios from 'axios'
import { Category, UnIdentifiedDecision, Entity, Check, NLPVersion } from 'dbsder-api-types'
import { UnexpectedError } from '../error'
import { NLP_PSEUDONYMISATION_API_URL } from '../../connectors/env'

export type NerResponse = {
  entities: Entity[]
  checklist: Check[]
  versions: NLPVersion
  newCategoriesToAnnotate?: Category[]
  newCategoriesToUnAnnotate?: Category[]
  additionalTermsToAnnotate?: string[]
  additionalTermsToUnAnnotate?: string[]
}

export type NerParameters = {
  sourceId: UnIdentifiedDecision['sourceId']
  sourceName: UnIdentifiedDecision['sourceName']
  parties: UnIdentifiedDecision['parties']
  text: UnIdentifiedDecision['originalText']
  categories: Category[]
  additionalTerms: UnIdentifiedDecision['occultation']['additionalTerms']
}

export async function postNer(parameters: NerParameters): Promise<NerResponse> {
  const route = `${NLP_PSEUDONYMISATION_API_URL}/ner`
  const data = {
    sourceId: parameters.sourceId,
    sourceName: parameters.sourceName,
    parties: parameters.parties,
    text: parameters.text,
    categories: parameters.categories,
    additionalTerms: parameters.additionalTerms
  }
  try {
    const response = await axios.post<NerResponse>(route, data)
    return response.data
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      throw new UnexpectedError(
        `Call POST - ${route} response with code ${err.response.status}: ${err.response.data.message}`
      )
    }
    throw err
  }
}
