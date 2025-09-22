import axios from "axios";
import { DBSDER_API_KEY, DBSDER_API_URL } from "./env";
import { CodeNac, UnIdentifiedDecisionCph } from "dbsder-api-types";
import { UnexpectedError } from "./error";

export async function sendToSder(decision: UnIdentifiedDecisionCph) {
  const route = `${DBSDER_API_URL}/decisions`
  try {
    const response = await axios.put(route, { decision }, { headers: { "x-api-key": DBSDER_API_KEY } });
    return response.data
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      throw new UnexpectedError(`Call PUT - ${route} response with code ${err.response.status}: ${err.response.data.message}`)
    }
    throw err
  }
}

export async function getCodeNac(codenac: string): Promise<CodeNac | null> {
  const route = `${DBSDER_API_URL}/codenacs/${codenac}`
  try {
    const response = await axios.get<CodeNac>(route, { headers: { "x-api-key": DBSDER_API_KEY } })
    return response.data
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      throw new UnexpectedError(`Call GET - ${route} response with code ${err.response.status}: ${err.response.data.message}`)
    }
    throw err
  }
}