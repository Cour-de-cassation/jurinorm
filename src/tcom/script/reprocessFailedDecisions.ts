import * as dotenv from 'dotenv'
dotenv.config()

import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  ListObjectsCommand,
  ListObjectsCommandOutput
} from '@aws-sdk/client-s3'

async function main() {
  let count = 0
  const decisions = await listFailedDecisions()
  for (let i = 0; i < decisions.length; i++) {
    try {
      const done = await reprocessFailedDecisionByKey(decisions[i])
      if (done) {
        count++
      }
    } catch (e) {
      console.error(e)
    }
  }
  console.log(`Reprocessed ${count} failed PDF`)
}

async function listFailedDecisions(): Promise<Array<string>> {
  const list = []
  const s3Client = new S3Client({
    endpoint: process.env.S3_URL,
    forcePathStyle: true,
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY
    }
  })
  let done = false
  let marker = null
  while (done === false) {
    const reqParams = {
      Bucket: process.env.S3_BUCKET_NAME_PDF2TEXT_FAILED,
      Marker: undefined
    }
    if (marker !== null) {
      reqParams.Marker = marker
    }
    try {
      const listObjects: ListObjectsCommandOutput = await s3Client.send(
        new ListObjectsCommand(reqParams)
      )
      if (listObjects && listObjects.Contents) {
        listObjects.Contents.forEach((item) => {
          list.push(item.Key)
          marker = item.Key
        })
        if (listObjects.IsTruncated === false) {
          done = true
        }
      } else {
        done = true
      }
    } catch (error) {
      console.log({ operationName: 'listFailedDecisions', msg: error.message, data: error })
    }
  }
  return list
}

async function reprocessFailedDecisionByKey(key: string): Promise<boolean> {
  const s3Client = new S3Client({
    endpoint: process.env.S3_URL,
    forcePathStyle: true,
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY
    }
  })
  const getPDFReqParams = {
    Bucket: process.env.S3_BUCKET_NAME_PDF2TEXT_FAILED,
    Key: key
  }
  const fileFromS3 = await s3Client.send(new GetObjectCommand(getPDFReqParams))
  const fileContent = Buffer.from(await fileFromS3.Body?.transformToByteArray())
  const copyPDFReqParams = {
    Bucket: process.env.S3_BUCKET_NAME_PDF,
    Key: `${key}`,
    Body: fileContent,
    ContentType: 'application/pdf',
    ACL: 'public-read',
    Metadata: {
      date: new Date().toISOString(),
      originalPdfFileName: `${key}`
    }
  } as unknown as any
  await s3Client.send(new PutObjectCommand(copyPDFReqParams))
  await s3Client.send(new DeleteObjectCommand(getPDFReqParams))
  return true
}

main()
