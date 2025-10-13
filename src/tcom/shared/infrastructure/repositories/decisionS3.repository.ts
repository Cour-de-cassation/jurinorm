import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2CommandInput,
  _Object,
  ListObjectsV2Command,
  DeleteObjectCommand
} from '@aws-sdk/client-s3'
import { BucketError } from '../../domain/errors/bucket.error'
import { DecisionRepository } from './decision.repository'
import { CollectDto } from '../dto/collect.dto'
import { logger } from '../../../../library/logger'

export class DecisionS3Repository implements DecisionRepository {
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

  async saveDecision(reqParams): Promise<void> {
    try {
      await this.s3Client.send(new PutObjectCommand(reqParams))
    } catch (error) {
      logger.error({
        path: 'src/tcoshared/infrastructure/repositories/decisionS3.repository.ts',
        operations: ["normalization", `saveDecision-TCOM`],
        message: error.message,
        stack: error.stack
      })
      throw new BucketError(error)
    }
  }

  async saveDataDecisionIntegre(
    requestToS3Dto: string,
    originalPdfFileName: string,
    jsonS3Key: string
  ): Promise<void> {
    const now = new Date()
    now.setMilliseconds(0)
    const reqParams = {
      Body: requestToS3Dto,
      Bucket: process.env.S3_BUCKET_NAME_RAW_TCOM,
      Key: `${jsonS3Key}`,
      Metadata: {
        date: now.toISOString(),
        originalPdfFileName: originalPdfFileName
      }
    }

    await this.saveDecision(reqParams)
  }

  async deleteDecision(reqParams): Promise<void> {
    try {
      await this.s3Client.send(new DeleteObjectCommand(reqParams))
    } catch (error) {
      logger.error({
        path: 'src/tcoshared/infrastructure/repositories/decisionS3.repository.ts',
        operations: ["normalization", `deleteDecision-TCOM`],
        message: error.message,
        stack: error.stack
      })
      throw new BucketError(error)
    }
  }

  async deleteDataDecisionIntegre(jsonS3Key: string): Promise<void> {
    const reqParamsMarkForDeletion = {
      Body: JSON.stringify({
        date: new Date()
      }),
      Bucket: process.env.S3_BUCKET_NAME_DELETION,
      Key: `${jsonS3Key}.deletion`,
      Metadata: {
        date: new Date().toISOString()
      }
    }

    await this.saveDecision(reqParamsMarkForDeletion)

    const reqParamsDelete = {
      Bucket: process.env.S3_BUCKET_NAME_RAW_TCOM,
      Key: `${jsonS3Key}`
    }

    await this.deleteDecision(reqParamsDelete)
  }

  async saveDecisionNormalisee(requestToS3Dto: string, filename: string) {
    const reqParams = {
      Body: requestToS3Dto,
      Bucket: process.env.S3_BUCKET_NAME_NORMALIZED_TCOM,
      Key: filename
    }

    await this.saveDecision(reqParams)
  }

  async uploadFichierDecisionIntegre(
    file: Express.Multer.File,
    originalPdfFileName: string,
    pdfS3Key: string
  ): Promise<void> {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME_PDF,
      Key: `${pdfS3Key}`,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
      Metadata: {
        date: new Date().toISOString(),
        originalPdfFileName: originalPdfFileName
      }
    } as unknown as any

    try {
      await this.s3Client.send(new PutObjectCommand(params))
    } catch (error) {
      logger.error({
        path: 'src/tcoshared/infrastructure/repositories/decisionS3.repository.ts',
        operations: ["normalization", `putDecision-TCOM`],
        message: error.message,
        stack: error.stack
      })
      throw new BucketError(error)
    }
  }

  async getDecisionByFilename(
    filename: string
  ): Promise<CollectDto & { _id: string }> {
    const reqParams = {
      Bucket: process.env.S3_BUCKET_NAME_NORMALIZED_TCOM,
      Key: filename
    }

    try {
      const decisionFromS3 = await this.s3Client.send(new GetObjectCommand(reqParams))
      const stringifiedDecision = await decisionFromS3.Body?.transformToString()
      return JSON.parse(stringifiedDecision)
    } catch (error) {
      logger.error({
        path: 'src/tcoshared/infrastructure/repositories/decisionS3.repository.ts',
        operations: ["normalization", `getDecisionByFilename-TCOM`],
        message: error.message,
        stack: error.stack
      })
      throw new BucketError(error)
    }
  }

  async getPDFByFilename(filename: string): Promise<Buffer> {
    const reqParams = {
      Bucket: process.env.S3_BUCKET_NAME_PDF,
      Key: filename
    }

    try {
      const fileFromS3 = await this.s3Client.send(new GetObjectCommand(reqParams))
      return Buffer.from(await fileFromS3.Body?.transformToByteArray())
    } catch (error) {
      logger.error({
        path: 'src/tcoshared/infrastructure/repositories/decisionS3.repository.ts',
        operations: ["normalization", `getPDFByFilename-TCOM`],
        message: error.message,
        stack: error.stack
      })
      throw new BucketError(error)
    }
  }

  async archiveFailedPDF(file: Buffer, key: string): Promise<void> {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME_PDF2TEXT_FAILED,
      Key: `${key}`,
      Body: file,
      ContentType: 'application/pdf',
      ACL: 'public-read',
      Metadata: {
        date: new Date().toISOString(),
        originalPdfFileName: `${key}`
      }
    } as unknown as any

    try {
      await this.s3Client.send(new PutObjectCommand(params))
    } catch (error) {
      logger.error({
        path: 'src/tcoshared/infrastructure/repositories/decisionS3.repository.ts',
        operations: ["normalization", `archiveFailedPDF-TCOM`],
        message: error.message,
        stack: error.stack
      })
      throw new BucketError(error)
    }
  }

  async archiveSuccessPDF(data: object, key: string): Promise<void> {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME_PDF2TEXT_SUCCESS,
      Key: `${key}`,
      Body: JSON.stringify(data),
      ACL: 'public-read',
      Metadata: {
        date: new Date().toISOString(),
        originalPdfFileName: `${key}`
      }
    } as unknown as any

    try {
      await this.s3Client.send(new PutObjectCommand(params))
    } catch (error) {
      logger.error({
        path: 'src/tcoshared/infrastructure/repositories/decisionS3.repository.ts',
        operations: ["normalization", `archiveSuccessPDF-TCOM`],
        message: error.message,
        stack: error.stack
      })
      throw new BucketError(error)
    }
  }

  async getDecisionList(
    bucket?: string,
    maxNumberOfDecisionsToRetrieve?: number,
    startAfterFileName?: string
  ): Promise<_Object[]> {
    const reqParams: ListObjectsV2CommandInput = {
      Bucket: bucket ?? process.env.S3_BUCKET_NAME_RAW_TCOM
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
        path: 'src/tcoshared/infrastructure/repositories/decisionS3.repository.ts',
        operations: ["normalization", `getDecisionList-TCOM`],
        message: error.message,
        stack: error.stack
      })
      throw new BucketError(error)
    }
  }
}
