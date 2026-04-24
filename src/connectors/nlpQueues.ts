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
  NLP_NER: "nlp.ner",
  NLP_DONE: "nlp.done",
  JURINORM_FAIL: "jurinorm.fail",
}

export type NerParameters = {
  rawId: string
  rawCollection?: string  // pour CC/CA/TJ
  decisionFilename?: string  // pour TCOM
  pdfFilename?: string       // pour TCOM avec PLAINTEXT_SOURCE=nlp
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
  await channel.assertQueue(QUEUES.NLP_NER, { durable: true })
  await channel.assertQueue(QUEUES.NLP_DONE, { durable: true })
  await channel.assertQueue(QUEUES.JURINORM_FAIL, { durable: true })
}

// --- PRODUCER ---
export async function publishToNer(parameters: NerParameters): Promise<void> {
  const channel = await getAmqpChannel()
  const msgToSend = Buffer.from(JSON.stringify(parameters))
  channel.sendToQueue(QUEUES.NLP_NER, msgToSend, { persistent: true })

  logger.info({
    path: 'src/connectors/nlpQueues.ts',
    operations: ['normalization', 'publishToNer'],
    message: `Decision ${parameters.rawId} sent to NLP queue.`
  })
}

// --- CONSUMER ---
export async function startNlpDoneConsumer(): Promise<void> {
  const channel = await getAmqpChannel()
  const prefetch = Number(NLP_DONE_PREFETCH ?? '1')
  channel.prefetch(prefetch)

  channel.consume(QUEUES.NLP_DONE, async (doneMsg) => {
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
        operations: ['normalization', 'nlpDoneConsumer'],
        message: `Decision rawId=${rawId} saved in database`
      })

      channel.ack(doneMsg)
    } catch (err) {
      logger.error({
        path: 'src/connectors/nlpQueues.ts',
        operations: ['normalization', 'nlpDoneConsumer'],
        stack: err instanceof Error ? err.stack : undefined,
        message: `Failed to apply NLP result for rawId=${rawId}: ${err instanceof Error ? err.message : 'Unknown error'}`
      })
      // Nested try/catch needed because channel may have died, making amqp calls unsafe
      try {
        parsed.error = err instanceof Error ? err.message : 'Unknown error'
        const failMsg = Buffer.from(JSON.stringify(parsed))
        channel.sendToQueue(QUEUES.JURINORM_FAIL, failMsg, { persistent: true })
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