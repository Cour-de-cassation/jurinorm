import express, { Express, json, NextFunction, Request, Response } from 'express'
import helmet from 'helmet'

import { logger, loggerHttp } from './library/logger'
import normalizeRouter from './controller/normalize'
import { errorHandler } from './controller/error'
import { apiKeyHandler } from './controller/authentication'
import { PORT } from './library/env'
import './service/decisionNormalizationWorker'
import path from 'path'

const app: Express = express()

app
  .use(helmet())
  .use(loggerHttp)
  .use(apiKeyHandler)
  .use(json({ limit: '10mb' }))

  .use((req: Request, _: Response, next: NextFunction) => {
    req.log.info({
      operationName: 'request',
      url: `${req.method} ${req.originalUrl}`
    })
    next()
  })

  .use(normalizeRouter)
  .use(errorHandler)

app.listen(PORT, () => {
  logger.info({
    type: 'tech',
    path: 'server.ts',
    msg: `Jurinorm running on port ${PORT}`
  })
})
