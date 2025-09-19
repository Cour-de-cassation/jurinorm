import {
  S3Client,
  S3ClientConfig,
  PutObjectCommand,
  GetObjectCommand,
  _Object,
} from "@aws-sdk/client-s3";
import { UnexpectedError } from "./error";
import { S3_ACCESS_KEY, S3_BUCKET_NAME, S3_REGION, S3_SECRET_KEY, S3_URL } from "./env";

const S3Options: S3ClientConfig = {
  endpoint: S3_URL,
  forcePathStyle: true,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
};

const s3Client = new S3Client(S3Options);

export function saveFile(
  name: string,
  buffer: Buffer,
  contentType: string = "application/octet-stream"
): Promise<unknown> {
  return s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: name,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

export async function getFileByName(
  name: string
): Promise<Buffer> {
  const fileFromS3 = await s3Client.send(
    new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: name })
  );
  if (!fileFromS3.Body)
    throw new UnexpectedError(`File: ${name} seems empty or its body cannot be read.`);
  const byteArray = await fileFromS3.Body.transformToByteArray();
  return Buffer.from(byteArray.buffer);
}
