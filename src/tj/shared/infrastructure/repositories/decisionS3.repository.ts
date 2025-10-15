import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandInput,
  _Object
} from '@aws-sdk/client-s3'
import { CollectDto } from '../dto/collect.dto'
import { BucketError } from '../../domain/errors/bucket.error'
import { logger } from '../../../../library/logger'
export class DecisionS3Repository {
  private s3Client: S3Client

  constructor(providedS3Client?: S3Client) {
    if (providedS3Client) {
      this.s3Client = providedS3Client
    } else {
      this.s3Client = new S3Client({
        endpoint: process.env.S3_URL,
        forcePathStyle: true,
        region: process.env.S3_REGION,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY,
          secretAccessKey: process.env.S3_SECRET_KEY
        }
      })
    }
  }

  async saveDecisionIntegre(requestToS3Dto: string, filename: string) {
    const reqParams = {
      Body: requestToS3Dto,
      Bucket: process.env.S3_BUCKET_NAME_RAW_TJ,
      Key: filename
    }

    await this.saveDecision(reqParams)
  }

  async saveDecisionNormalisee(requestToS3Dto: string, filename: string) {
    const reqParams = {
      Body: requestToS3Dto,
      Bucket: process.env.S3_BUCKET_NAME_NORMALIZED_TJ,
      Key: filename
    }
    await this.saveDecision(reqParams)
  }

  async saveDecision(reqParams): Promise<void> {
    try {
      await this.s3Client.send(new PutObjectCommand(reqParams))
    } catch (error) {
      logger.error({
        path: 'src/tj/shared/infrasturcture/repositories/decisionS3.repository.ts',
        operations: ['other', 'saveDecision'],
        message: error.message,
        stack: error.stack
      })
      throw new BucketError(error)
    }
  }

  async deleteDecision(filename: string, bucketName: string): Promise<void> {
    const reqParams = {
      Bucket: bucketName,
      Key: filename
    }

    try {
      await this.s3Client.send(new DeleteObjectCommand(reqParams))
    } catch (error) {
      logger.error({
        path: 'src/tj/shared/infrasturcture/repositories/decisionS3.repository.ts',
        operations: ['other', 'deleteDecision'],
        message: error.message,
        stack: error.stack
      })
      throw new BucketError(error)
    }
  }

  async getDecisionByFilename(filename: string): Promise<CollectDto> {
    const reqParams = {
      Bucket: process.env.S3_BUCKET_NAME_RAW_TJ,
      Key: filename
    }

    try {
      const decisionFromS3 = await this.s3Client.send(new GetObjectCommand(reqParams))
      const stringifiedDecision = await decisionFromS3.Body?.transformToString()
      return JSON.parse(stringifiedDecision)
    } catch (error) {
      logger.error({
        path: 'src/tj/shared/infrasturcture/repositories/decisionS3.repository.ts',
        operations: ['other', 'getDecisionByFilename'],
        message: error.message,
        stack: error.stack
      })
      throw new BucketError(error)
    }
  }

  async getNormalizedDecisionByFilename(filename: string): Promise<CollectDto> {
    const reqParams = {
      Bucket: process.env.S3_BUCKET_NAME_NORMALIZED_TJ,
      Key: filename
    }

    try {
      const decisionFromS3 = await this.s3Client.send(new GetObjectCommand(reqParams))
      const stringifiedDecision = await decisionFromS3.Body?.transformToString()
      return JSON.parse(stringifiedDecision)
    } catch (error) {
      logger.error({
        path: 'src/tj/shared/infrasturcture/repositories/decisionS3.repository.ts',
        operations: ['other', 'getNormalizedDecisionByFilename'],
        message: error.message,
        stack: error.stack
      })
      throw new BucketError(error)
    }
  }

  async getDecisionList(
    maxNumberOfDecisionsToRetrieve?: number,
    startAfterFileName?: string
  ): Promise<_Object[]> {
    const reqParams: ListObjectsV2CommandInput = {
      Bucket: process.env.S3_BUCKET_NAME_RAW_TJ
    }
    if (maxNumberOfDecisionsToRetrieve >= 1 && maxNumberOfDecisionsToRetrieve <= 1000) {
      reqParams.MaxKeys = maxNumberOfDecisionsToRetrieve
    }
    if (startAfterFileName) reqParams.StartAfter = startAfterFileName

    try {
      const decisionListFromS3 = await this.s3Client.send(new ListObjectsV2Command(reqParams))
      return decisionListFromS3.Contents ? decisionListFromS3.Contents : []
    } catch (error) {
      logger.error({
        path: 'src/tj/shared/infrasturcture/repositories/decisionS3.repository.ts',
        operations: ['other', 'getDecisionList'],
        message: error.message,
        stack: error.stack
      })
      throw new BucketError(error)
    }
  }
}
