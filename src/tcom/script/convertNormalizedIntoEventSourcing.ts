import {
    S3_BUCKET_NAME_RAW_TCOM,
    DEPRECATED_S3_BUCKET_NAME_NORMALIZED_TCOM
} from '../../library/env'
import { DecisionS3Repository } from '../shared/infrastructure/repositories/decisionS3.repository'
import { createFileInformation } from '../../library/DbRaw'
import { RawTcom } from '../batch/normalization/infrastructure/decision.dto'
import { GetObjectCommand, GetObjectCommandOutput, S3Client } from '@aws-sdk/client-s3'
import { logger } from '../../library/logger'
import { CollectDto } from '../shared/infrastructure/dto/collect.dto'

const s3Client = new S3Client({
    endpoint: process.env.S3_URL,
    forcePathStyle: true,
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY
    }
})

async function getDecisionByFilename(
    filename: string,
    bucket: string
): Promise<GetObjectCommandOutput> {
    const reqParams = {
        Bucket: bucket,
        Key: filename
    }

    try {
        const decisionFromS3 = await s3Client.send(new GetObjectCommand(reqParams))
        return decisionFromS3
    } catch (error) {
        logger.error({
            path: 'script',
            operations: ["normalization", `getDecisionByFilename-TCOM`],
            message: error.message,
            stack: error.stack
        })
        throw error
    }
}

const MAX_NUMBER_OF_DECISIONS_TO_RETRIEVE = 1000

async function listFromS3(
    filename?: string
): Promise<string[]> {
    const repository = new DecisionS3Repository()
    const rawDecisionList = await repository.getDecisionList(
        DEPRECATED_S3_BUCKET_NAME_NORMALIZED_TCOM,
        MAX_NUMBER_OF_DECISIONS_TO_RETRIEVE,
        filename
    )

    const keyList = rawDecisionList.map(_ => _.Key)
    return rawDecisionList.length === MAX_NUMBER_OF_DECISIONS_TO_RETRIEVE ?
        listFromS3(keyList[keyList.length - 1]).then(_ => [...keyList, ..._]) :
        keyList
}

async function getPdf(filename: string) {
    const pdfFileName = filename.replace('.json$', '.pdf')
    const decision = await getDecisionByFilename(
        S3_BUCKET_NAME_RAW_TCOM,
        pdfFileName
    )

    return {
        path: pdfFileName,
        date: decision.LastModified
    }
}

async function getMetadata(filename: string): Promise<[CollectDto, Date]> {
    const pdfFileName = filename.replace('.pdf$', '.json')
    const decisionFromS3 = await getDecisionByFilename(
        DEPRECATED_S3_BUCKET_NAME_NORMALIZED_TCOM,
        pdfFileName
    )
    const stringifiedDecision = await decisionFromS3.Body?.transformToString()
    return [JSON.parse(stringifiedDecision), decisionFromS3.LastModified]
}

async function createFromS3(
    filename: string
) {
    const { path, date } = await getPdf(filename)
    const [{ metadonnees }, normalizedDate] = await getMetadata(filename)

    return createFileInformation<Omit<RawTcom, '_id'>>(
        S3_BUCKET_NAME_RAW_TCOM,
        {
            path,
            events: [{ type: "created", date }, { type: "normalized", date: normalizedDate }],
            metadonnees
        }
    )
}

async function main() {
    const files = await listFromS3()
    return Promise.allSettled(files.map(createFromS3))
}

main().then(console.log).catch(console.error)
