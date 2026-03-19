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
  console.log(`Reprocessed ${count} failed decisions`)
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
      Bucket: process.env.S3_BUCKET_NAME_DECISION_FAILED,
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
  const getDecisionReqParams = {
    Bucket: process.env.S3_BUCKET_NAME_DECISION_FAILED,
    Key: key
  }
  const fileFromS3 = await s3Client.send(new GetObjectCommand(getDecisionReqParams))
  const fileContent = await fileFromS3.Body?.transformToString()
  const copyDecisionReqParams = {
    Bucket: process.env.S3_BUCKET_NAME_RAW_TCOM,
    Key: `${key}`,
    Body: fileContent,
    ContentType: 'application/json',
    Metadata: {
      date: new Date().toISOString(),
      originalFilename: `${key}`
    }
  } as unknown as any
  await s3Client.send(new PutObjectCommand(copyDecisionReqParams))
  await s3Client.send(new DeleteObjectCommand(getDecisionReqParams))
  return true
}

main()
