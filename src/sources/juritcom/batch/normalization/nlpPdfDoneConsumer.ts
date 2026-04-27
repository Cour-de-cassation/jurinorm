import { json } from 'zod'
import { getAmqpChannel } from '../../../../connectors/amqp'
import { QUEUES } from '../../../../connectors/nlpQueues'
import { HTMLToPlainText, markdownToPlainText, NLPPDFToTextDTO } from './services/PDFToText'
import { CollectDto } from '../../shared/infrastructure/dto/collect.dto'
import { DecisionS3Repository } from '../../shared/infrastructure/repositories/decisionS3.repository'
import { ZoningApiService } from './services/zoningApi.service'
import { normalizeDecision } from './normalization'
import { logger } from './logger'

export async function startNlpPdfDoneConsumer(): Promise<void> {
  const channel = await getAmqpChannel()
  channel.prefetch(1)

  channel.consume(QUEUES.NLP_PDF_TO_TEXT_DONE, async(msg) => {
    if (!msg) {
      return
    }

    let decisionFilename: string | undefined
    let parsed: Record<string, unknown> = {}

    try {
      const s3Repository = new DecisionS3Repository()
      const zoningApiService = new ZoningApiService()

      parsed = JSON.parse(msg.content.toString())
      decisionFilename = parsed.decisionFilename as string
      const { pdfFilename, jobId, nlpData } = parsed as {
        pdfFilename: string
        jobId: string
        nlpData: NLPPDFToTextDTO
      }

      const decision = await s3Repository.getDecisionByFilename(decisionFilename, process.env.S3_BUCKET_NAME_PENDING_TCOM)
      if (nlpData.HTMLText) {
        decision.texteDecisionIntegre = HTMLToPlainText(nlpData.HTMLText)
      } else if (nlpData.markdownText) {
        decision.texteDecisionIntegre = markdownToPlainText(nlpData.markdownText)
      } else {
        throw new Error(`No text extracted from decision ${decisionFilename}`)
      }

      await s3Repository.archiveSuccessPDF(nlpData, pdfFilename)
      await normalizeDecision(decision, decisionFilename, jobId, s3Repository, zoningApiService, true)

      channel.ack(msg)
    } catch (error) {
      logger.error({
        path: 'src/sources/juritcom/batch/normalization/nlpPdfDoneConsumer.ts',
        operations: ['normalization', 'nlpPdfDoneConsumer'],
        stack: error instanceof Error ? error.stack : undefined,
        message: `Failed to process nlp.pdf.done for ${decisionFilename}: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
      try {
        parsed.error = error instanceof Error ? error.message : 'Unknown error'
        channel.sendToQueue(QUEUES.JURINORM_NLP_PDF_TO_TEXT_DONE_FAIL, Buffer.from(JSON.stringify(parsed)), { persistent: true })
        channel.nack(msg, false, false)
      } catch (channelErr) {
        logger.error({
          path: 'src/sources/juritcom/batch/normalization/nlpPdfDoneConsumer.ts',
          operations: ['normalization', 'nlpPdfDoneConsumer'],
          stack: channelErr instanceof Error ? channelErr.stack : undefined,
          message: `Failed to nack/fail for ${decisionFilename}: ${channelErr instanceof Error ? channelErr.message : 'Unknown error'}`
        })
      }
    }
  })
}