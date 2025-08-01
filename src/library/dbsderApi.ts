import { CodeNac, UnIdentifiedDecision } from 'dbsder-api-types'
import { DBSDER_API_URL, DBSDER_API_KEY } from './env'
import { UnexpectedError } from './error'
import axios, { AxiosError } from 'axios'

export async function putDecision(decision: UnIdentifiedDecision) {
  try {
    const result = await axios.put(
      `${DBSDER_API_URL}/decisions`,
      { decision },
      {
        headers: {
          'x-api-key': DBSDER_API_KEY
        }
      }
    )
    return result
  } catch (err) {
    if (!(err instanceof AxiosError)) throw new UnexpectedError()
    if (
      err instanceof AxiosError &&
      err.response &&
      err.response.status &&
      err.response.status < 400 &&
      err.response.status >= 500
    )
      throw new UnexpectedError(
        'dbsder-api service is currently unavailable, status: ' + err.response.status
      )
  }
}

export async function getCodeNac(code: string): Promise<CodeNac> {
  try {
    const result = await axios.get(`${DBSDER_API_URL}/codenacs/${code}`, {
      headers: {
        'x-api-key': DBSDER_API_KEY
      }
    })
    return result.data
  } catch (err) {
    if (!(err instanceof AxiosError)) throw new UnexpectedError()
    if (
      err instanceof AxiosError &&
      err.response &&
      err.response.status &&
      err.response.status < 400 &&
      err.response.status >= 500
    )
      throw new UnexpectedError(
        'dbsder-api service is currently unavailable, status: ' + err.response.status
      )
    throw new UnexpectedError('Failed to fetch CodeNac')
  }
}
