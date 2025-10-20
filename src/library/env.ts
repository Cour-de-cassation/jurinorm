import dotenv from 'dotenv'
import { MissingValue } from './error'
import { resolve } from 'path'

if (!process.env.NODE_ENV) dotenv.config({ path: resolve(__dirname, '..', '..', '.env') })

if (process.env.DBSDER_API_KEY == null) throw new MissingValue('process.env.DBSDER_API_KEY')
if (process.env.DBSDER_API_URL == null) throw new MissingValue('process.env.DBSDER_API_URL')
if (process.env.FILE_DB_URL == null) throw new MissingValue('process.env.FILE_DB_URL')
if (process.env.NLP_PSEUDONYMISATION_API_URL == null)
  throw new MissingValue('process.env.NLP_PSEUDONYMISATION_API_URL')
if (process.env.NODE_ENV == null) throw new MissingValue('process.env.NODE_ENV')
if (process.env.S3_ACCESS_KEY == null) throw new MissingValue('process.env.S3_ACCESS_KEY')
if (process.env.S3_BUCKET_NAME_PORTALIS == null)
  throw new MissingValue('process.env.S3_BUCKET_NAME_PORTALIS')
if (process.env.S3_REGION == null) throw new MissingValue('process.env.S3_REGION')
if (process.env.S3_SECRET_KEY == null) throw new MissingValue('process.env.S3_SECRET_KEY')
if (process.env.S3_URL == null) throw new MissingValue('process.env.S3_URL')
if (process.env.COLLECTION_JURINET_RAW == null)
  throw new MissingValue('process.env.COLLECTION_JURINET_RAW')
if (process.env.COLLECTION_JURICA_RAW == null)
  throw new MissingValue('process.env.COLLECTION_JURICA_RAW')

export const {
  DBSDER_API_KEY,
  DBSDER_API_URL,
  FILE_DB_URL,
  NLP_PSEUDONYMISATION_API_URL,
  NODE_ENV,
  NORMALIZATION_BATCH_SCHEDULE,
  S3_ACCESS_KEY,
  S3_BUCKET_NAME_PORTALIS,
  S3_REGION,
  S3_SECRET_KEY,
  S3_URL,
  COLLECTION_JURINET_RAW,
  COLLECTION_JURICA_RAW
} = process.env
