import {
  Document,
  MongoClient,
  Filter,
  FindCursor,
  WithId,
  ObjectId,
  WithoutId,
  UpdateFilter
} from 'mongodb'
import { FILE_DB_URL } from './env'

const client = new MongoClient(FILE_DB_URL)

async function dbConnect() {
  const db = client.db()
  await client.connect()
  return db
}

export async function updateFileInformation<T extends Document>(
  collection: string,
  id: ObjectId,
  file: Partial<WithoutId<T>>
): Promise<WithId<T> | null> {
  const db = await dbConnect()
  return await db.collection<T>(collection).findOneAndUpdate(
    { _id: id } as Filter<T>, // MongoType seems dumb with inferId type
    { $set: file } as UpdateFilter<T>, // MongoType seems dumb with inferId type
    { returnDocument: 'after' }
  )
}

export async function countFileInformations<T extends Document>(
  collection: string,
  filters: Filter<T>
): Promise<number> {
  const db = await dbConnect()
  return db.collection<T>(collection).countDocuments(filters)
}

export async function findFileInformations<T extends Document>(
  collection: string,
  filters: Filter<T>
): Promise<FindCursor<WithId<T>>> {
  const db = await dbConnect()
  return db.collection<T>(collection).find(filters)
}

export async function disconnect() {
  await dbConnect()
  return client.close()
}

export async function mapCursorSync<T, U>(
  cursor: FindCursor<T>,
  callbackFn: (element: T) => Promise<U>
): Promise<U[]> {
  const element = await cursor.next()
  if (!element) return Promise.resolve([])

  const res = await callbackFn(element)
  return [res, ...(await mapCursorSync(cursor, callbackFn))]
}

export type Id = ObjectId
