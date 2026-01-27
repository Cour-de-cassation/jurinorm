import { isRawCph, RawCph } from "./cph/models"
import { countFileInformations, findFileInformations, mapCursorSync } from "../../connectors/DbRawFile"
import { logger } from "../../connectors/logger"
import { S3_BUCKET_NAME_PORTALIS } from "src/connectors/env"
import { NormalizationResult, RawFile, updateRawFileStatus } from "../eventSourcing"
import { normalizeRawCphFiles } from "./cph/normalization"
import { NotSupported, toUnexpectedError } from "../error"

type RawPortalis = RawCph | RawFile<unknown>

const rawToNormalize = {
    // Ne contient pas normalized:
    events: { $not: { $elemMatch: { type: 'normalized' } } },
    // Les 3 derniers events ne sont pas "blocked":
    $expr: {
        $not: {
            $eq: [
                3,
                {
                    $size: {
                        $filter: {
                            input: { $slice: ['$events', -3] },
                            as: 'e',
                            cond: { $eq: ['$$e.type', 'blocked'] }
                        }
                    }
                }
            ]
        }
    }
}

export async function normalizeRawPortalisFiles(
    defaultFilter?: Parameters<typeof findFileInformations<RawPortalis>>[1],
    limit?: number
) {
    const _rawToNormalize = defaultFilter ?? rawToNormalize

    logger.info({
        path: 'src/service/portalis/index.ts',
        operations: ['normalization', 'normalizeRawPortalisFiles'],
        message: `Starting Portalis normalization`
    })
    const rawCursor = await findFileInformations<RawPortalis>(
        S3_BUCKET_NAME_PORTALIS,
        _rawToNormalize,
        limit
    )
    const rawLength = await countFileInformations<RawPortalis>(
        S3_BUCKET_NAME_PORTALIS,
        _rawToNormalize
    )
    logger.info({
        path: 'src/service/portalis/index.ts',
        operations: ['normalization', 'normalizeRawPortalisFiles'],
        message: `Find ${rawLength} raw decisions to normalize batch. Limit is set to ${limit}`
    })

    const results: NormalizationResult<RawPortalis>[] = await mapCursorSync(
        rawCursor,
        async (raw) => {
            try {
                if (isRawCph(raw)) {
                    const result = await normalizeRawCphFiles(raw)
                    await updateRawFileStatus(S3_BUCKET_NAME_PORTALIS, result)
                    return result
                }
                throw new NotSupported("rawPortalis", raw._id, 'jurisdiction not supported for Portalis decision')
            } catch (err) {
                const error = toUnexpectedError(err)
                logger.error({
                    path: 'src/service/portalis/index.ts',
                    operations: ['normalization', 'normalizeRawPortalisFiles'],
                    message: `${raw._id} failed to normalize`,
                    stack: error.stack
                })

                const result = { rawFile: raw, status: 'error', error } as const
                await updateRawFileStatus(S3_BUCKET_NAME_PORTALIS, result)
                return result
            }
        }
    )

    await Promise.all(results)

    logger.info({
        path: 'src/service/portalis/index.ts',
        operations: ['normalization', 'normalizeRawPortalisFiles'],
        message: `Decisions successfully normalized: ${results.filter(({ status }) => status === 'success').length
            }`
    })
    logger.info({
        path: 'src/service/portalis/index.ts',
        operations: ['normalization', 'normalizeRawPortalisFiles'],
        message: `Decisions skipped: ${results.filter(({ status }) => status === 'error').length}`
    })
}