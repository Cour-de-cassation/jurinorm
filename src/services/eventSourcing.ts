import { isMissingValue, toUnexpectedError, UnexpectedError } from './error'
import { Id, updateFileInformation, appendEventToFile } from '../connectors/dbRawFile'
import { logger } from '../config/logger'
import { ObjectId } from 'mongodb'

export type Created = {
  type: 'created'
  date: Date
}

type ArtificiallyCreated = { type: 'created'; date: null }

export type Normalized = {
  type: 'normalized'
  date: Date
}

export type Blocked = {
  type: 'blocked'
  date: Date
  reason: string
}

export type Unblocked = {
  type: 'unblocked'
  date: Date
  reason: string
}

export type Deleted = {
  type: 'deleted'
  date: Date
}

export type NlpPending = {
  type: 'nlpPending'
  date: Date
}

export type Event = Created | Normalized | Blocked | Unblocked | Deleted | NlpPending

export type RawFile<T> = {
  _id: Id
  path: string
  events: [Created | ArtificiallyCreated, ...Event[]]
  metadatas: T
}

export type NormalizationSucess<T extends RawFile<unknown>> = {
  rawFile: T
  status: 'success'
}

export type NormalizationError<T extends RawFile<unknown>> = {
  rawFile: T
  status: 'error'
  error: Error
}

export type NormalizationDeleted<T extends RawFile<unknown>> = {
  rawFile: T
  status: 'deleted'
}

export type NormalizationNlpPending<T extends RawFile<unknown>> = {
  rawFile: T
  status: 'nlpPending'
}

export type NormalizationResult<T extends RawFile<unknown>> =
  | NormalizationError<T>
  | NormalizationSucess<T>
  | NormalizationDeleted<T>
  | NormalizationNlpPending<T>

async function updateEventRawFile<T>(
  collection: string,
  file: RawFile<T>,
  event: Exclude<Event, Created>
) {
  try {
    const updated = await updateFileInformation<typeof file>(collection, file._id, {
      events: [...file.events, event]
    })
    if (!updated) throw new UnexpectedError(`file with id ${file._id} is missing but normalized`)
    return updated
  } catch (err) {
    if (isMissingValue(err)) throw err
    throw err instanceof Error ? toUnexpectedError(err) : new UnexpectedError()
  }
}

export async function updateRawFileStatus<T extends RawFile<unknown>>(
  collection: string,
  result: NormalizationResult<T>
): Promise<unknown> {
  const date = new Date()
  try {
    if (result.status === 'success')
      return updateEventRawFile(collection, result.rawFile, { type: 'normalized', date })
    if (result.status === 'deleted')
      return updateEventRawFile(collection, result.rawFile, { type: 'deleted', date })
    if (result.status === 'nlpPending')
      return updateEventRawFile(collection, result.rawFile, { type: 'nlpPending', date })

    return updateEventRawFile(collection, result.rawFile, {
      type: 'blocked',
      date,
      reason: `${result.error}`
    })
  } catch (err) {
    const error = toUnexpectedError(err)
    logger.error({
      path: __filename.split('/src').pop(),
      operations: ['normalization', 'updateRawFileStatus'],
      message: `${result.rawFile._id} has been treated with a status: ${result.status} but has not be saved in rawFiles`,
      stack: error.stack
    })
  }
}

export async function appendNormalizedEvent(collection: string, id: ObjectId): Promise<void> {
  await appendEventToFile(collection, id, { type: 'normalized', date: new Date() })
}
