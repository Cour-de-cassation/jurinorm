import { toUnexpectedError, UnexpectedError } from './error'
import { Id, updateFileInformation } from '../connectors/DbRawFile'
import { logger } from '../connectors/logger'

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

export type Deleted = {
  type: 'deleted'
  date: Date
}

export type Event = Created | Normalized | Blocked | Deleted

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

export type NormalizationResult<T extends RawFile<unknown>> =
  | NormalizationError<T>
  | NormalizationSucess<T>
  | NormalizationDeleted<T>

function mapNormalizationResultIntoEvent<T extends RawFile<unknown>>(
  normalizationResult: NormalizationResult<T>
): Exclude<Event, Created> {
  const date = new Date()
  switch (normalizationResult.status) {
    case 'error':
      return { type: 'blocked', date, reason: `${normalizationResult.error}` }
    case 'success':
      return { type: 'normalized', date }
    case 'deleted':
      return { type: 'deleted', date }
    default:
      const x: never = normalizationResult
      throw new UnexpectedError("normalization result is unknown")
  }
}

export async function updateRawFileStatus<T>(
  collection: string,
  result: NormalizationResult<RawFile<T>>
): Promise<unknown> {
  try {
    const rawFile = result.rawFile
    const updated = await updateFileInformation<typeof rawFile>(collection, rawFile._id, {
      events: [...rawFile.events, mapNormalizationResultIntoEvent(result)]
    })
    if (!updated) throw new UnexpectedError(`file with id ${rawFile._id} is missing but normalized`)
    return updated
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
