import axios, { AxiosError } from 'axios'
import * as FormData from 'form-data'

import { Category, UnIdentifiedDecision, Entity, Check, NLPVersion } from 'dbsder-api-types'
import { UnexpectedError } from '../services/error'
import { NLP_PSEUDONYMISATION_API_URL } from '../config/env'

export type NerParameters = {
  sourceId: UnIdentifiedDecision['sourceId']
  sourceName: UnIdentifiedDecision['sourceName']
  parties: UnIdentifiedDecision['parties']
  text: UnIdentifiedDecision['originalText']
  categories: Category[]
  additionalTerms: UnIdentifiedDecision['occultation']['additionalTerms']
}

export type NerResponse = {
  entities: Entity[]
  checklist: Check[]
  versions: NLPVersion
  newCategoriesToAnnotate?: Category[]
  newCategoriesToUnAnnotate?: Category[]
  additionalTermsToAnnotate?: string[]
  additionalTermsToUnAnnotate?: string[]
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

type PdfToTextParameters = {
  force_ocr: boolean
}

type PdfToTextResponse = {
  HTMLText: string
  images: { [key: string]: string }
}

export async function postPdfToText(
  fileName: string,
  fileContent: Buffer,
  parameters: PdfToTextParameters = { force_ocr: true }
): Promise<string> {
  const route = `${NLP_PSEUDONYMISATION_API_URL}/pdf-to-text`
  const form = new FormData()
  form.append('pdf_file', fileContent, {
    filename: fileName,
    contentType: 'application/pdf'
  })

  try {
    const response = await axios.postForm<PdfToTextResponse>(route, form, {
      headers: form.getHeaders(),
      params: parameters
    })
    return response.data.HTMLText
  } catch (err) {
    // NLP could be occupied and ask for waiting
    if (err instanceof AxiosError && err.status === 429) {
      const MINUTE = 1000 * 60
      return new Promise((res, rej) =>
        setTimeout(
          () => postPdfToText(fileName, fileContent, parameters).then(res).catch(rej),
          MINUTE
        )
      )
    }
    throw err
  }
}
