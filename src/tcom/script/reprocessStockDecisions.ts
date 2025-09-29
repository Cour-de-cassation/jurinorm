import * as dotenv from 'dotenv'
dotenv.config()

import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3'
import { DbSderApiGateway } from '../batch/normalization/repositories/gateways/dbsderApi.gateway'

let batchSize: number
const dbSderApiGateway = new DbSderApiGateway()

async function main(count: string) {
  batchSize = parseInt(count, 10)

  if (isNaN(batchSize)) {
    batchSize = 100
  }

  const decisions = await dbSderApiGateway.listDecisions('ignored_controleRequis')
  let decision = await decisions.next()
  let doneCount = 0

  while (decision) {
    try {
      const done = await reprocessNormalizedDecisionByFilename(decision.filenameSource)
      if (done) {
        console.log(`Reprocess ${decision._id}`)
        doneCount++
      } else {
        console.log(`Skip ${decision._id}`)
      }
    } catch (_ignore) {
      console.log(`Skip ${decision._id}`)
    }

    decision = await decisions.next()
  }

  console.log(`Reprocessed ${doneCount} decisions`)
}

async function reprocessNormalizedDecisionByFilename(filename: string): Promise<boolean> {
  const s3Client = new S3Client({
    endpoint: process.env.S3_URL,
    forcePathStyle: true,
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY
    }
  })
  const reqParams = {
    Bucket: process.env.S3_BUCKET_NAME_NORMALIZED,
    Key: filename
  }
  try {
    const decisionFromS3 = await s3Client.send(new GetObjectCommand(reqParams))
    const stringifiedDecision = await decisionFromS3.Body?.transformToString()
    const objectDecision = JSON.parse(stringifiedDecision)
    // 1. Check .metadonnees.idDecision + '.json' === filename:
    if (
      objectDecision &&
      objectDecision.metadonnees &&
      `${objectDecision.metadonnees.idDecision}.json` === filename
    ) {
      // 2. remove texteDecisionIntegre
      objectDecision.texteDecisionIntegre = null
      // 3. copy to raw:
      const reqCopyParams = {
        Body: JSON.stringify(objectDecision),
        Bucket: process.env.S3_BUCKET_NAME_RAW,
        Key: filename
      }
      await s3Client.send(new PutObjectCommand(reqCopyParams))
      // 4. Delete from normalized:
      await s3Client.send(new DeleteObjectCommand(reqParams))
      return true
    } else {
      throw new Error('Decision incomplete or ID mismatch')
    }
  } catch (error) {
    console.log({
      operationName: 'reprocessNormalizedDecisionByFilename',
      msg: error.message,
      data: error
    })
    return false
  }
}

main(process.argv[2])
