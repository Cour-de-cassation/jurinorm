import { S3Client, S3ClientConfig, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { UnexpectedError } from './error'
import { S3_ACCESS_KEY, S3_REGION, S3_SECRET_KEY, S3_URL } from './env'

const S3Options: S3ClientConfig = {
  endpoint: S3_URL,
  forcePathStyle: true,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY
  }
}

const s3Client = new S3Client(S3Options)

export function saveFile(
  bucketName: string,
  name: string,
  buffer: Buffer,
  contentType: string = 'application/octet-stream'
): Promise<unknown> {
  return s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: name,
      Body: buffer,
      ContentType: contentType
    })
  )
}

export async function getFileByName(bucketName: string, fileName: string): Promise<Buffer> {
  const fileFromS3 = await s3Client.send(
    new GetObjectCommand({ Bucket: bucketName, Key: fileName })
  )
  if (!fileFromS3.Body)
    throw new UnexpectedError(`File: ${name} seems empty or its body cannot be read.`)
  const byteArray = await fileFromS3.Body.transformToByteArray()
  return Buffer.from(byteArray.buffer)
}
