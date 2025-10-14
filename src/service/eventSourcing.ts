import { Id, updateRawInformation } from '../library/DbRaw'
import { isMissingValue, toUnexpectedError, UnexpectedError } from '../library/error'
import { logger } from '../library/logger'

export type Created = {
  type: 'created'
  date: Date
}
export type Normalized = {
  type: 'normalized'
  date: Date
}
export type Blocked = {
  type: 'blocked'
  date: Date
  reason: string
}
export type Deleted = {
  type: 'deleted'
  date: Date
}
export type Event = Created | Normalized | Blocked | Deleted

type DocumentWithEvents<T extends Record<string, unknown>> = T & {
  _id: Id
  events: [Created, ...Event[]]
}

async function updateEventRaw<T extends Record<string, unknown>>(
  collection: string,
  file: DocumentWithEvents<T>,
  event: Exclude<Event, Created>
) {
  try {
    const updated = await updateRawInformation<DocumentWithEvents<T>>(collection, file._id, {
      events: [...file.events, event]
    } as Partial<DocumentWithEvents<T>>)
    if (!updated) throw new UnexpectedError(`file with id ${file._id} is missing but normalized`)
    return updated
  } catch (err) {
    if (isMissingValue(err)) throw err
    throw err instanceof Error ? toUnexpectedError(err) : new UnexpectedError()
  }
}

export type NormalizationSucess<T extends Record<string, unknown>> = {
  rawDecision: T
  status: 'success'
}

export type NormalizationError<T extends Record<string, unknown>> = {
  rawDecision: T
  status: 'error'
  error: Error
}

export type NormalizationResult<T extends Record<string, unknown>> =
  | NormalizationError<T>
  | NormalizationSucess<T>

export async function updateRawStatus<T extends Record<string, unknown>>(
  collection: string,
  result: NormalizationResult<DocumentWithEvents<T>>
): Promise<unknown> {
  const date = new Date()
  try {
    if (result.status === 'success')
      return updateEventRaw(collection, result.rawDecision, { type: 'normalized', date })
    return updateEventRaw(collection, result.rawDecision, {
      type: 'blocked',
      date,
      reason: `${result.error}`
    })
  } catch (err) {
    const error = toUnexpectedError(err)
    logger.error({
      path: 'src/service/eventSourcing.ts',
      operations: ['normalization', `updateRawStatus`],
      message: `${result.rawDecision._id} has been treated with a status: ${result.status} but has not be saved in ${collection}`,
      stack: error.stack
    })
  }
}
