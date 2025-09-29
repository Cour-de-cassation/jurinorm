import { v4 as uuid } from "uuid";

import { isMissingValue, toUnexpectedError, UnexpectedError } from "../../library/error";
import {
  Created,
  Event,
  FileCph,
  NormalizationResult,
  RawCph,
} from "./models";
import { countFileInformations, createFileInformation, findFileInformations, findFileInformationsList, mapCursorSync, updateFileInformation } from "../../library/DbRawFile";
import { normalizeCph, rawCphToNormalize } from "./normalization";
import { saveFile } from "../../library/bucket";
import { logger } from "../../library/logger";

async function updateEventRawCph(file: RawCph, event: Exclude<Event, Created>) {
  try {
    const updated = await updateFileInformation<RawCph>(
      file._id,
      { events: [...file.events, event] }
    )
    if (!updated) throw new UnexpectedError(
      `file with id ${file._id} is missing but normalized`
    )
    return updated
  } catch (err) {
    if (isMissingValue(err)) throw err
    throw err instanceof Error ? toUnexpectedError(err) : new UnexpectedError()
  }
}

async function updateRawCphStatus(result: NormalizationResult): Promise<unknown> {
  const date = new Date()
  try {
    if (result.status === "success") return updateEventRawCph(
      result.rawCph,
      { type: "normalized", date }
    )
    return updateEventRawCph(
      result.rawCph,
      { type: "blocked", date, reason: `${result.error}` }
    )
  } catch (err) {
    const error = toUnexpectedError(err)
    logger.error({
      path: "src/service/cph/handler.ts",
      operations: ["normalization", "updateRawCphStatus"],
      message: `${result.rawCph._id} has been treated with a status: ${result.status} but has not be saved in rawFiles`,
      stack: error.stack
    })
  }
}

export async function createRawCph(
  file: FileCph,
  metadatas: RawCph["metadatas"]
): Promise<RawCph> {
  const date = new Date()
  const path = `${uuid()}-${date.toISOString()}.pdf`;

  try {
    await saveFile(
      path,
      file.buffer,
      "application/pdf"
    )

    return createFileInformation({
      path,
      metadatas,
      events: [{ type: "created", date }]
    })
  } catch (err) {
    throw err instanceof Error ? toUnexpectedError(err) : new UnexpectedError()
  }
}

export async function getRawCphStatus(fromDate: Date, fromId?: string) {
  const BATCH_SIZE = 100

  const filter = { events: { $elemMatch: { type: "created", date: { $gte: fromDate } } } }
  const files = await findFileInformationsList<RawCph>(filter, fromId, BATCH_SIZE + 1)
  const cphStatus = files.slice(0, BATCH_SIZE).map(_ => ({
    id: _._id,
    originalId: _.metadatas.identifiantDecision,
    created: _.events.find(_ => _.type === "created")?.date.toISOString(), // type safe due "created" cannot undefined
    status: _.events.reverse()[0] as Event // type safe due to _events cannot empty
  }
  ))

  return {
    cphList: cphStatus,
    nextBatchId: files.length > BATCH_SIZE ? cphStatus[cphStatus.length - 1]?.id : null
  }
}


export async function normalizeRawCphFiles(
  defaultFilter?: Parameters<typeof findFileInformations<RawCph>>[0]
) {
  const _rawCphToNormalize = defaultFilter ?? rawCphToNormalize
  const rawCphCursor = await findFileInformations<RawCph>(_rawCphToNormalize)
  const rawCphLength = await countFileInformations<RawCph>(_rawCphToNormalize)
  logger.info({
    path: "src/service/cph/handler.ts",
    operations: ["normalization", "normalizeRawCphFiles"],
    message: `Find ${rawCphLength} raw decisions to normalize`
  })

  const results: NormalizationResult[] = await mapCursorSync(rawCphCursor, async rawCph => {
    try {
      logger.info({
        path: "src/service/cph/handler.ts",
        operations: ["normalization", "normalizeRawCphFiles"],
        message: `normalize ${rawCph._id} - ${rawCph.path}`
      })
      await normalizeCph(rawCph)
      logger.info({
        path: "src/service/cph/handler.ts",
        operations: ["normalization", "normalizeRawCphFiles"],
        message: `${rawCph._id} normalized with success`
      })
      return { rawCph, status: "success" }
    } catch (err) {
      const error = toUnexpectedError(err)
      logger.error({
        path: "src/service/cph/handler.ts",
        operations: ["normalization", "normalizeRawCphFiles"],
        message: `${rawCph._id} failed to normalize`,
        stack: error.stack
      })
      return { rawCph, status: "error", error }
    }
  })

  await Promise.all(results.map(updateRawCphStatus))

  logger.info({
    path: "src/service/cph/handler.ts",
    operations: ["normalization", "normalizeRawCphFiles"],
    message: `Decisions successfully normalized: ${results.filter(({ status }) => status === "success").length}`
  })
  logger.info({
    path: "src/service/cph/handler.ts",
    operations: ["normalization", "normalizeRawCphFiles"],
    message: `Decisions skipped: ${results.filter(({ status }) => status === "error").length}`
  })
}
