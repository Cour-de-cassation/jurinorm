import { Id } from '../library/DbRawFile'


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
