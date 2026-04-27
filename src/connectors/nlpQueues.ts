import { Category, UnIdentifiedDecision } from 'dbsder-api-types'
import { logger } from '../config/logger'
import { getAmqpChannel } from "./amqp"
import { applyNerResult } from "../services/rules/annotation"
import { saveDecisionInAffaire } from "../services/affaire"
import { UnIdentifiedDecisionSupported } from "./dbSder"
import { appendNormalizedEvent } from "../services/eventSourcing"
import { ObjectId } from "mongodb"
import { NLP_DONE_PREFETCH } from '../config/env'
import { NerResponse } from './ner'

export const QUEUES = {
  NLP_PROCESS: "nlp.process",
  NLP_NER_DONE: 'nlp.ner.done',
  NLP_PDF_TO_TEXT_DONE: "nlp.pdfToText.done",
  JURINORM_NLP_NER_DONE_FAIL: "jurinorm.nlp.ner.done.fail",
  JURINORM_NLP_PDF_TO_TEXT_DONE_FAIL: "jurinorm.nlp.pdfToText.done.fail"
}

export type NerParameters = {
  rawId: string
  rawCollection?: string     // for CC/CA/TJ/CPH
  decisionFilename?: string  // for TCOM
  pdfFilename?: string       // for TCOM
  decision: UnIdentifiedDecision
  sourceId: UnIdentifiedDecision['sourceId']
  sourceName: UnIdentifiedDecision['sourceName']
  parties: UnIdentifiedDecision['parties']
  text: UnIdentifiedDecision['originalText']
  categories: Category[]
  additionalTerms: string
}

export async function assertQueues(): Promise<void> {
  const channel = await getAmqpChannel()
  for (const queue of Object.values(QUEUES)) {
    await channel.assertQueue(queue, { durable: true })
  }
}

// --- PRODUCERS ---
export async function publishToNlpNer(parameters: NerParameters): Promise<void> {
  const channel = await getAmqpChannel()
  const msgToSend = Buffer.from(JSON.stringify(parameters))
  channel.sendToQueue(QUEUES.NLP_PROCESS, msgToSend, { persistent: true })

  logger.info({
    path: 'src/connectors/nlpQueues.ts',
    operations: ['normalization', 'publishToNlpNer'],
    message: `Decision ${parameters.rawId} sent to NLP queue.`
  })
}

export async function publishToNlpPdf(
  pdfFilename: string,
  decisionFilename: string,
  jobId: string
): Promise<void> {
  const channel = await getAmqpChannel()
  const msgToSend = Buffer.from(JSON.stringify({ pdfFilename, decisionFilename, jobId }))
  channel.sendToQueue(QUEUES.NLP_PROCESS, msgToSend, { persistent: true })

  logger.info({
    path: 'src/connectors/nlpQueues.ts',
    operations: ['normalization', 'publishToNlpPdf'],
    message: `PDF ${pdfFilename} for decision ${decisionFilename} sent to NLP queue with jobId=${jobId}.`

  })
}

// --- CONSUMERS ---
export async function startNlpNerDoneConsumer(): Promise<void> {
  const channel = await getAmqpChannel()
  const prefetch = Number(NLP_DONE_PREFETCH ?? '1')
  channel.prefetch(prefetch)

  channel.consume(QUEUES.NLP_NER_DONE, async (doneMsg) => {
    if (!doneMsg) {
      return
    }

    let rawId: string | undefined
    let sourceName: string | undefined
    let parsed: Record<string, unknown> = {}

    try {
      parsed = JSON.parse(doneMsg.content.toString())
      rawId = parsed.rawId as string
      sourceName = parsed.sourceName as string
      const { decision, ...nerResult } = parsed
      const annotatedDecision = applyNerResult(
        decision as UnIdentifiedDecision,
        nerResult as NerResponse
      )
      await saveDecisionInAffaire(annotatedDecision as UnIdentifiedDecisionSupported)
      if (sourceName.toLowerCase() !== 'juritcom') {
        await appendNormalizedEvent(parsed.rawCollection as string, new ObjectId(rawId))
      }

      logger.info({
        path: 'src/connectors/nlpQueues.ts',
        operations: ['normalization', 'startNlpNerDoneConsumer'],
        message: `Decision rawId=${rawId} for ${sourceName} saved in database`
      })

      channel.ack(doneMsg)
    } catch (err) {
      logger.error({
        path: 'src/connectors/nlpQueues.ts',
        operations: ['normalization', 'startNlpNerDoneConsumer'],
        stack: err instanceof Error ? err.stack : undefined,
        message: `Failed to apply NLP result for rawId=${rawId}: ${err instanceof Error ? err.message : 'Unknown error'}`
      })
      // Nested try/catch needed because channel may have died, making amqp calls unsafe
      try {
        parsed.error = err instanceof Error ? err.message : 'Unknown error'
        const failMsg = Buffer.from(JSON.stringify(parsed))
        channel.sendToQueue(QUEUES.JURINORM_NLP_NER_DONE_FAIL, failMsg, { persistent: true })
        channel.nack(doneMsg, false, false)
      } catch (channelErr) {
        logger.error({
          path: 'src/connectors/nlpQueues.ts',
          operations: ['normalization', 'nlpDoneConsumer'],
          stack: channelErr instanceof Error ? channelErr.stack : undefined,
          message: `Failed to send rawId=${rawId} to fail queue: ${channelErr instanceof Error ? channelErr.message : 'Unknown error'}`
        })
      }

    }
  })
}