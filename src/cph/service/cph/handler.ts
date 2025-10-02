import { isMissingValue, toUnexpectedError, UnexpectedError } from "../../../library/error";
import {
  Created,
  Event,
  NormalizationResult,
  RawCph,
} from "./models";
import { countFileInformations, findFileInformations, mapCursorSync, updateFileInformation } from "../../library/DbRawFile";
import { normalizeCph, rawCphToNormalize } from "./normalization";
import { logger } from "../../../library/logger";

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
