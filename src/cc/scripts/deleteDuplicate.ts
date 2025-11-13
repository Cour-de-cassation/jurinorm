import { findFileInformations, disconnect, updateFileInformation } from '../../library/DbRawFile'
import { COLLECTION_JURINET_RAW } from '../../library/env'
import { logger } from '../../library/logger'
import { RawCc } from '../models'
import { Deleted } from '../../services/eventSourcing'

async function markDuplicateDeleted() {
  logger.info({
    path: 'src/cc/scripts/deleteDuplicate.ts',
    operations: ['other', 'markDuplicateDeleted'],
    message: 'Starting duplicate deletion process'
  })

  try {
    const rawCcCursor = await findFileInformations<RawCc>(COLLECTION_JURINET_RAW, {
      events: { $not: { $elemMatch: { type: 'normalized' } } }
    })

    const sourceIdMap = new Map<number, RawCc[]>()

    for await (const rawCc of rawCcCursor) {
      const sourceId = rawCc.metadatas.sourceId
      if (!sourceIdMap.has(sourceId)) {
        sourceIdMap.set(sourceId, [])
      }
      sourceIdMap.get(sourceId)!.push(rawCc)
    }

    logger.info({
      path: 'src/cc/scripts/deleteDuplicate.ts',
      operations: ['other', 'markDuplicateDeleted'],
      message: `Found ${sourceIdMap.size} unique sourceIds`
    })

    let totalDuplicates = 0
    let totalDeleted = 0
    const deletedEvent: Deleted = {
      type: 'deleted',
      date: new Date()
    }

    for (const [sourceId, documents] of sourceIdMap.entries()) {
      if (documents.length > 1) {
        totalDuplicates += documents.length - 1

        // Most recent first
        documents.sort((a, b) => {
          const createdEventA = a.events.find((event) => event.type === 'created')
          const createdEventB = b.events.find((event) => event.type === 'created')
          return createdEventB.date.getTime() - createdEventA.date.getTime()
        })

        const [mostRecent, ...duplicates] = documents

        logger.info({
          path: 'src/cc/scripts/deleteDuplicate.ts',
          operations: ['other', 'markDuplicateDeleted'],
          message: `Found ${documents.length} documents with sourceId: ${sourceId}. Keeping most recent: ${mostRecent._id}`
        })

        for (const duplicate of duplicates) {
          try {
            await updateFileInformation<RawCc>(COLLECTION_JURINET_RAW, duplicate._id, {
              events: [...duplicate.events, deletedEvent]
            })
            totalDeleted++
          } catch (error) {
            logger.error({
              path: 'src/cc/scripts/deleteDuplicate.ts',
              operations: ['other', 'markDuplicateDeleted'],
              message: `Failed to mark ${duplicate._id} as deleted`,
              stack: error instanceof Error ? error.stack : error
            })
          }
        }
      }
    }

    logger.info({
      path: 'src/cc/scripts/deleteDuplicate.ts',
      operations: ['other', 'markDuplicateDeleted'],
      message: `Process completed. Total duplicates found: ${totalDuplicates}, Total marked as deleted: ${totalDeleted}`
    })
  } catch (error) {
    logger.error({
      path: 'src/cc/scripts/deleteDuplicate.ts',
      operations: ['other', 'markDuplicateDeleted'],
      message: 'Failed to process duplicates',
      stack: error instanceof Error ? error.stack : String(error)
    })
    throw error
  } finally {
    await disconnect()
  }
}

markDuplicateDeleted()
