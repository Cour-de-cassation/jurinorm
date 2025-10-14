import dotenv from 'dotenv'
import { MissingValue } from './error'
import { resolve } from 'path'

if (!process.env.NODE_ENV) dotenv.config({ path: resolve(__dirname, '..', '..', '.env') })

// COMMON
if (process.env.DBSDER_API_KEY == null) throw new MissingValue('process.env.DBSDER_API_KEY')
if (process.env.DBSDER_API_URL == null) throw new MissingValue('process.env.DBSDER_API_URL')
if (process.env.FILE_DB_URL == null) throw new MissingValue('process.env.FILE_DB_URL')
if (process.env.NLP_PSEUDONYMISATION_API_URL == null)
  throw new MissingValue('process.env.NLP_PSEUDONYMISATION_API_URL')
if (process.env.NODE_ENV == null) throw new MissingValue('process.env.NODE_ENV')
if (process.env.S3_ACCESS_KEY == null) throw new MissingValue('process.env.S3_ACCESS_KEY')
if (process.env.S3_REGION == null) throw new MissingValue('process.env.S3_REGION')
if (process.env.S3_SECRET_KEY == null) throw new MissingValue('process.env.S3_SECRET_KEY')
if (process.env.S3_URL == null) throw new MissingValue('process.env.S3_URL')

// CPH
if (process.env.S3_BUCKET_NAME_PORTALIS == null)
  throw new MissingValue('process.env.S3_BUCKET_NAME_PORTALIS')

// TJ
if (process.env.S3_BUCKET_NAME_RAW_TJ == null)
  throw new MissingValue('process.env.S3_BUCKET_NAME_RAW_TJ')
if (process.env.S3_BUCKET_NAME_NORMALIZED_TJ == null)
  throw new MissingValue('process.env.S3_BUCKET_NAME_NORMALIZED_TJ')

//TCOM
if (process.env.PLAINTEXT_SOURCE == null)
  throw new MissingValue('process.env.PLAINTEXT_SOURCE')
if (process.env.S3_BUCKET_NAME_PDF == null)
  throw new MissingValue('process.env.S3_BUCKET_NAME_PDF')
if (process.env.S3_BUCKET_NAME_RAW_TCOM == null)
  throw new MissingValue('process.env.S3_BUCKET_NAME_RAW_TCOM')
if (process.env.S3_BUCKET_NAME_NORMALIZED_TCOM == null)
  throw new MissingValue('process.env.S3_BUCKET_NAME_NORMALIZED_TCOM')

// should throw typescript error if env doesn't exists on strictNullChecks=true .
export const {
  DBSDER_API_KEY,
  DBSDER_API_URL,
  FILE_DB_URL,
  NLP_PSEUDONYMISATION_API_URL,
  NODE_ENV,
  NORMALIZATION_BATCH_SCHEDULE,
  S3_ACCESS_KEY,
  S3_REGION,
  S3_SECRET_KEY,
  S3_URL,
  S3_BUCKET_NAME_PORTALIS,
  S3_BUCKET_NAME_RAW_TJ,
  S3_BUCKET_NAME_NORMALIZED_TJ,
  S3_BUCKET_NAME_PDF: S3_BUCKET_NAME_RAW_TCOM,
  S3_BUCKET_NAME_RAW_TCOM: DEPRECATED_S3_BUCKET_NAME_RAW_TCOM,
  S3_BUCKET_NAME_NORMALIZED_TCOM: DEPRECATED_S3_BUCKET_NAME_NORMALIZED_TCOM,
  PLAINTEXT_SOURCE
}: Record<string, string> = process.env
