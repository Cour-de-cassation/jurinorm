import * as dotenv from 'dotenv'

dotenv.config()

import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3'
import { DbSderApiGateway } from '../batch/normalization/repositories/gateways/dbsderApi.gateway'

const dbSderApiGateway = new DbSderApiGateway()

async function main(status: string) {
  console.log(`Processing decisions with status ${status}...`)
  const decisions = await dbSderApiGateway.listDecisions(status)
  let decision = await decisions.next()
  let doneCount = 0
  let totalCount = 0
  while (decision) {
    totalCount++
    if (decision.sourceName === 'juritcom' && decision.labelStatus === status) {
      try {
        const done = await reprocessNormalizedDecisionByFilename(decision.filenameSource)
        if (done) {
          await dbSderApiGateway.deleteDecisionById(decision._id)
          console.log(`Reprocess ${decision._id}`)
          doneCount++
        } else {
          console.log(`Skip not done ${decision._id}`)
        }
      } catch (_ignore) {
        console.log(`Skip error ${decision._id}`)
      }
    } else {
      console.log(`Skip wrong decision ${decision._id}`)
    }
    decision = await decisions.next()
  }

  console.log(`Reprocessed ${doneCount}/${totalCount} decisions with status ${status}`)
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
    Bucket: process.env.S3_BUCKET_NAME_NORMALIZED_TCOM,
    Key: filename
  }
  try {
    const decisionFromS3 = await s3Client.send(new GetObjectCommand(reqParams))
    const stringifiedDecision = await decisionFromS3.Body?.transformToString()
    const objectDecision = JSON.parse(stringifiedDecision)
    // 1. Check objectDecision.metadonnees:
    if (!objectDecision || !objectDecision.metadonnees || !objectDecision.metadonnees.idDecision) {
      throw new Error('Decision not found or incomplete')
    }
    // 2. Check objectDecision.metadonnees.idDecision + '.json' === filename:
    if (`${objectDecision.metadonnees.idDecision}.json` === filename) {
      // 3. remove texteDecisionIntegre
      objectDecision.texteDecisionIntegre = null
      // 4. copy to raw:
      const reqCopyParams = {
        Body: JSON.stringify(objectDecision),
        Bucket: process.env.S3_BUCKET_NAME_RAW_TCOM,
        Key: filename
      }
      await s3Client.send(new PutObjectCommand(reqCopyParams))
      // 5. Delete from normalized:
      await s3Client.send(new DeleteObjectCommand(reqParams))
      return true
    } else {
      throw new Error(
        `File ID mismatch, looking for ${filename} but found ${objectDecision.metadonnees.idDecision}.json`
      )
    }
  } catch (e) {
    console.error(e)
    return false
  }
}

main(process.argv[2])
