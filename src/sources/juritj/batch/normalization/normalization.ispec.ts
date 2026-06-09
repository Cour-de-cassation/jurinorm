import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, Collection } from 'mongodb'
import { rawTjToNormalize } from './normalization'

const FILE_NAME = 'decision.wpd'

let mongoServer: MongoMemoryServer
let client: MongoClient
let collection: Collection

describe('rawTjToNormalize MongoDB Filter', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    client = new MongoClient(mongoServer.getUri())
    await client.connect()
    collection = client.db().collection('rawFiles')
  }, 120_000)

  afterEach(async () => {
    await collection.deleteMany({})
  })

  afterAll(async () => {
    await client.close()
    await mongoServer.stop()
  })

  it('selects a document with no event', async () => {
    await collection.insertOne({ path: FILE_NAME, events: [] })

    const rawFiles = await collection.find(rawTjToNormalize).toArray()

    expect(rawFiles).toHaveLength(1)
  })

  it('selects a document with less than 3 blocked events', async () => {
    await collection.insertOne({
      path: FILE_NAME,
      events: [
        { type: 'blocked', date: new Date(), reason: 'random error' },
        { type: 'blocked', date: new Date(), reason: 'random error' }
      ]
    })

    const rawFiles = await collection.find(rawTjToNormalize).toArray()

    expect(rawFiles).toHaveLength(1)
  })

  it('selects a document when the last 3 events are not all blocked', async () => {
    await collection.insertOne({
      path: FILE_NAME,
      events: [
        { type: 'blocked', date: new Date(), reason: 'random error' },
        { type: 'created', date: new Date() },
        { type: 'blocked', date: new Date(), reason: 'random error' },
        { type: 'blocked', date: new Date(), reason: 'random error' },
        { type: 'updated', date: new Date() }
      ]
    })

    const rawFiles = await collection.find(rawTjToNormalize).toArray()

    expect(rawFiles).toHaveLength(1)
  })

  it('excludes a document with 3 consecutive blocked events', async () => {
    await collection.insertOne({
      path: FILE_NAME,
      events: [
        { type: 'created', date: new Date() },
        { type: 'blocked', date: new Date(), reason: 'random error' },
        { type: 'blocked', date: new Date(), reason: 'random error' },
        { type: 'blocked', date: new Date(), reason: 'random error' }
      ]
    })

    const rawFiles = await collection.find(rawTjToNormalize).toArray()

    expect(rawFiles).toHaveLength(0)
  })

  it('excludes a document with normalized event', async () => {
    await collection.insertOne({
      path: FILE_NAME,
      events: [{ type: 'normalized', date: new Date() }]
    })

    const rawFiles = await collection.find(rawTjToNormalize).toArray()

    expect(rawFiles).toHaveLength(0)
  })

  it('selects only matching documents from a mixed collection', async () => {
    await collection.insertMany([
      { path: 'new.wpd', events: [] },
      {
        path: 'retry.wpd',
        events: [{ type: 'blocked', date: new Date(), reason: 'random error' }]
      },
      { path: 'normalized_decision.wpd', events: [{ type: 'normalized', date: new Date() }] },
      {
        path: 'blocked_decision.wpd',
        events: [
          { type: 'blocked', date: new Date(), reason: 'random error' },
          { type: 'blocked', date: new Date(), reason: 'random error' },
          { type: 'blocked', date: new Date(), reason: 'random error' }
        ]
      }
    ])

    const rawFiles = await collection.find(rawTjToNormalize).toArray()

    expect(rawFiles).toHaveLength(2)
    const paths = rawFiles.map((rawFile) => rawFile.path)
    expect(paths).toEqual(['new.wpd', 'retry.wpd'])
  })
})
