import { isMissingValue, toUnexpectedError, UnexpectedError } from './error'
import { Id, updateFileInformation } from '../connectors/DbRawFile'
import { logger } from '../connectors/logger'

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

export type RawFile<T> = {
  _id: Id
  path: string
  events: [Created, ...Event[]]
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

export type NormalizationResult<T extends RawFile<unknown>> =
  | NormalizationError<T>
  | NormalizationSucess<T>
  | NormalizationDeleted<T>

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
