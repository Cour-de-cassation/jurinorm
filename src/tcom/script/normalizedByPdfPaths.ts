import { normalizationJob } from "../batch/normalization/normalization";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { S3_BUCKET_NAME_RAW_TCOM } from "../../library/env";

const s3Client = new S3Client({
    endpoint: process.env.S3_URL,
    forcePathStyle: true,
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY
    }
})


async function isFilenameExists(
    filename: string,
): Promise<boolean> {
    const reqParams = {
        Bucket: S3_BUCKET_NAME_RAW_TCOM,
        Key: filename
    }

    try {
        await s3Client.send(new GetObjectCommand(reqParams))
        return true
    } catch (error) {
        return false
    }
}

function rawPathsToNormalize(paths: string[]) {
    return {
        path: { $in: paths }
    }
}

function main() {
    const [_, ...pdfPaths] = process.argv
    const paths = pdfPaths.filter(isFilenameExists)
    const query = rawPathsToNormalize(paths)
    return normalizationJob(query)
}

main().then(console.log).catch(console.error)
