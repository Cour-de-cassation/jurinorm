import { 
    Document,
    MongoClient, 
    Filter, 
    FindCursor, 
    WithId, 
    ObjectId, 
    WithoutId, 
    OptionalUnlessRequiredId, 
    InferIdType, 
    UpdateFilter 
} from "mongodb"
import { FILE_DB_URL, S3_BUCKET_NAME } from "./env"

const client = new MongoClient(FILE_DB_URL)

async function dbConnect() {
    const db = client.db()
    await client.connect()
    return db
}

export async function createFileInformation<T extends Document>(
    file: OptionalUnlessRequiredId<T>,
): Promise<{ _id: InferIdType<T> } & typeof file> {
    const db = await dbConnect()
    const { insertedId } = await db
        .collection<T>(S3_BUCKET_NAME)
        .insertOne(file)
    return { _id: insertedId, ...file }
}

export async function updateFileInformation<T extends Document>(
    id: ObjectId,
    file: Partial<WithoutId<T>>,
): Promise<WithId<T> | null> {
    const db = await dbConnect()
    return await db
        .collection<T>(S3_BUCKET_NAME)
        .findOneAndUpdate(
            { _id: id } as Filter<T>, // MongoType seems dumb with inferId type
            { $set: file } as UpdateFilter<T>, // MongoType seems dumb with inferId type
            { returnDocument: "after" }
        )
}

export async function countFileInformations<T extends Document>(
    filters: Filter<T>
): Promise<number> {
    const db = await dbConnect()
    return db.collection<T>(S3_BUCKET_NAME).countDocuments(filters)
}

export async function findFileInformations<T extends Document>(
    filters: Filter<T>
): Promise<FindCursor<WithId<T>>> {
    const db = await dbConnect()
    return db.collection<T>(S3_BUCKET_NAME).find(filters)
}

export async function findFileInformationsList<T extends Document>(
    filters: Filter<T>,
    cursor: string | undefined,
    limit = 100
): Promise<WithId<T>[]> {
    const db = await dbConnect()
    const filtersWithPagination = cursor ? { _id: { $gt: new ObjectId(cursor) }, ...filters } : filters

    return db.collection<T>(S3_BUCKET_NAME)
        .find(filtersWithPagination)
        .sort({ _id: 1 })
        .limit(limit)
        .toArray()
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

    const res = await callbackFn(element);
    return [res, ...(await mapCursorSync(cursor, callbackFn))]
}

export type Id = ObjectId