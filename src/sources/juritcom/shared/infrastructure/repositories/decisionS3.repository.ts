import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { logger } from '../../../../../config/logger'
import { BucketError } from '../../domain/errors/bucket.error'

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
        path: 'src/sources/juritcom/shared/infrastructure/repositories/decisionS3.repository.ts',
        operations: ['normalization', 'getPDFByFilename'],
        message: error.message,
        stack: error.stack
      })
      throw new BucketError(error)
    }
  }
}
