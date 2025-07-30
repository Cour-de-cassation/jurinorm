import { NextFunction, Request, Response } from 'express'
import { UnauthorizedError } from '../library/error'

export const apiKeyHandler = async (req: Request, _: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key']
    if (typeof apiKey !== 'string') throw new UnauthorizedError()
    if (apiKey !== process.env.COLLECT_API_KEY) {
      throw new UnauthorizedError('Invalid API key')
    }

    next()
  } catch (err) {
    next(err)
  }
}
