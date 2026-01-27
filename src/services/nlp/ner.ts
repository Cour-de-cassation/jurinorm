import axios from 'axios'
import * as FormData from 'form-data'
import { Category, UnIdentifiedDecision, Entity, Check, NLPVersion } from 'dbsder-api-types'
import { UnexpectedError } from '../error'
import { NLP_PSEUDONYMISATION_API_URL } from '../../connectors/env'

/**
 * Should be in connectors as NLP connection
 */

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

type PdfToHtmlAnswer = {
  HTMLText: string
  images: { [key: string]: string }
}

export async function pdfToHtml(fileName: string, fileContent: Buffer): Promise<string> {
  const form = new FormData()
  form.append('pdf_file', fileContent, {
    filename: fileName,
    contentType: 'application/pdf'
  })
  try {
    const route = `${NLP_PSEUDONYMISATION_API_URL}/pdf-to-text`
    const res = await axios.postForm<PdfToHtmlAnswer>(route, form, {
      headers: form.getHeaders()
    })
    return res.data.HTMLText
  } catch (err) {
    // NLP could be occupied and ask for waiting
    if (axios.isAxiosError(err) && err.status === 429) {
      const MINUTE = 1000 * 60
      return new Promise((res, rej) =>
        setTimeout(() => pdfToHtml(fileName, fileContent).then(res).catch(rej), MINUTE)
      )
    }
    throw err
  }
}
