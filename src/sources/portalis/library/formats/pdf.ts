import * as FormData from 'form-data'
import axios, { AxiosError } from 'axios'
import { NLP_PSEUDONYMISATION_API_URL } from '../../../../config/env'

const ROUTE_URL = `${NLP_PSEUDONYMISATION_API_URL}/pdf-to-text`

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
    const res = await axios.postForm<PdfToHtmlAnswer>(ROUTE_URL, form, {
      headers: form.getHeaders()
    })
    return res.data.HTMLText
  } catch (err) {
    // NLP could be occupied and ask for waiting
    if (err instanceof AxiosError && err.status === 429) {
      const MINUTE = 1000 * 60
      return new Promise((res, rej) =>
        setTimeout(() => pdfToHtml(fileName, fileContent).then(res).catch(rej), MINUTE)
      )
    }
    throw err
  }
}
