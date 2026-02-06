import axios from 'axios'
import {
  Affaire,
  CodeNac,
  Decision,
  UnIdentifiedAffaire,
  UnIdentifiedDecision,
  UnIdentifiedDecisionDila
} from 'dbsder-api-types'
import { UnexpectedError } from '../services/error'
import { DBSDER_API_KEY, DBSDER_API_URL } from './env'

export type UnIdentifiedDecisionSupported = Exclude<UnIdentifiedDecision, UnIdentifiedDecisionDila>

export async function createDecision(
  decision: UnIdentifiedDecisionSupported
): Promise<{ _id: string }> {
  const route = `${DBSDER_API_URL}/decisions`
  try {
    const response = await axios.put<{ _id: string }>(
      route,
      { decision },
      { headers: { 'x-api-key': DBSDER_API_KEY } }
    )
    return response.data
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      throw new UnexpectedError(
        `Call PUT - ${route} response with code ${err.response.status}: ${err.response.data.message}`
      )
    }
    throw err
  }
}

export async function patchDecision(
  id: Decision['_id'],
  decisionFields: Partial<Decision>
): Promise<{ _id: string }> {
  const route = `${DBSDER_API_URL}/decisions/${id}`
  try {
    const response = await axios.patch<{ _id: string }>(route, decisionFields, {
      headers: { 'x-api-key': DBSDER_API_KEY }
    })
    return response.data
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      throw new UnexpectedError(
        `Call PATCH - ${route} response with code ${err.response.status}: ${err.response.data.message}`
      )
    }
    throw err
  }
}

export async function getCodeNac(codenac: string): Promise<CodeNac | null> {
  const route = `${DBSDER_API_URL}/codenacs/${codenac}`
  try {
    const response = await axios.get<CodeNac>(route, { headers: { 'x-api-key': DBSDER_API_KEY } })
    return response.data
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      throw new UnexpectedError(
        `Call GET - ${route} response with code ${err.response.status}: ${err.response.data.message}`
      )
    }
    throw err
  }
}

export async function createAffaire(affaire: UnIdentifiedAffaire): Promise<Affaire> {
  const route = `${DBSDER_API_URL}/affaires`
  try {
    const response = await axios.post<Affaire>(route, affaire, {
      headers: { 'x-api-key': DBSDER_API_KEY }
    })
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

export async function findAffaire(
  decisionId: string
): Promise<Affaire | null> {
  const route = `${DBSDER_API_URL}/affaires`
  try {
    const response = await axios.get<Affaire>(route, {
      headers: { 'x-api-key': DBSDER_API_KEY },
      params: { decisionId }
    })
    return response.data
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      if (err.response.status === 404) return null
      throw new UnexpectedError(
        `Call GET - ${route} response with code ${err.response.status}: ${err.response.data.message}`
      )
    }
    throw err
  }
}

export async function findDecisions<T extends Decision>(params: Partial<T>, searchAfter?: string) {
  const route = process.env.DBSDER_API_URL + '/decisions'
  type Response = {
    decisions: (Omit<T, '_id'> & { _id: string })[]
    totalDecisions: number
    nextCursor?: string
  }

  try {
    const response = await axios.get<Response>(route, {
      params: searchAfter ? { ...params, searchAfter } : params,
      headers: { 'x-api-key': process.env.DBSDER_API_KEY }
    })
    return response.data
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      throw new UnexpectedError(
        `Call GET - ${route} response with code ${err.response.status}: ${err.response.data.message}`
      )
    }
    throw err
  }
}

export async function listDecisions(filters: Partial<Decision>) {
  let response = await findDecisions(filters)
  let index = 0

  return {
    next: async () => {
      const decision = response.decisions[index]
      index++
      if (!!decision) return decision

      if (!!response.nextCursor) {
        console.log(`listDecisions nextCursor:${response.nextCursor}`)
        response = await findDecisions(filters, response.nextCursor)
        index = 1
        return response.decisions[0]
      }

      return undefined
    }
  }
}
