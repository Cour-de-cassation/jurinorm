import { Router } from 'express'
import { MissingValue } from '../library/error'
import {
  parseUnIdentifiedDecisionSupported,
  UnIdentifiedDecisionSupported
} from '../service/decision/models'
import { addDecisionToQueue } from '../service/redis'

const app = Router()

function parsePostBody(body: Request['body']): UnIdentifiedDecisionSupported {
  if (!body || !('decision' in body))
    throw new MissingValue('req.body', "body is missing on request or doesn't contain a decision")
  return parseUnIdentifiedDecisionSupported(body.decision)
}

app.post('/normalize', async (req, res, next) => {
  try {
    const decision = parsePostBody(req.body)
    await addDecisionToQueue(decision)

    res.send({
      message: 'Decision ajoutée a la file d’attente'
    })
  } catch (err: unknown) {
    next(err)
  }
})

export default app
