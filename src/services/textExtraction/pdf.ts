import { postPdfToText } from "../../connectors/ner"
import { logger } from "../../config/logger"
import { HtmlToPlainText } from "./html"

export async function getPdfContent(fileNamePdf: string, portalisFile: Buffer, forceOcr: boolean = true): Promise<string> {
  logger.info({
    path: __filename,
    operations: ['extraction', 'getPdfContent'],
    message: 'Waiting for text extraction'
  })
  const html = await postPdfToText(fileNamePdf, portalisFile, { force_ocr: forceOcr })
  logger.info({
    path: __filename,
    operations: ['extraction', 'getPdfContent'],
    message: 'Plain text successfully extracted by NLP API from collected PDF file'
  })
  return HtmlToPlainText(html)
}