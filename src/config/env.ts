import * as dotenv from 'dotenv'
import { MissingValue } from '../services/error'
import { resolve } from 'path'

if (!process.env.ENV) dotenv.config({ path: resolve(__dirname, '..', '..', '.env') })

if (process.env.DBSDER_API_KEY == null) throw new MissingValue('process.env.DBSDER_API_KEY')
if (process.env.DBSDER_API_URL == null) throw new MissingValue('process.env.DBSDER_API_URL')
if (process.env.ENV == null) throw new MissingValue('process.env.ENV')
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
if (process.env.BATCH_MAX_DECISIONS_CA == null)
  throw new MissingValue('process.env.BATCH_MAX_DECISIONS_CA')
if (process.env.BATCH_MAX_DECISIONS_TJ == null)
  throw new MissingValue('process.env.BATCH_MAX_DECISIONS_TJ')
if (process.env.BATCH_MAX_DECISIONS_TCOM == null)
  throw new MissingValue('process.env.BATCH_MAX_DECISIONS_TCOM')
if (process.env.BATCH_MAX_DECISIONS_CPH == null)
  throw new MissingValue('process.env.BATCH_MAX_DECISIONS_CPH')
if (process.env.BATCH_MAX_DECISIONS_JURICAV2 == null)
  throw new MissingValue('process.env.BATCH_MAX_DECISIONS_JURICAV2')
if (process.env.COLLECTION_JURICAV2_RAW == null)
  throw new MissingValue('process.env.COLLECTION_JURICAV2_RAW')

export const {
  DBSDER_API_KEY,
  DBSDER_API_URL,
  ENV,
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
  COLLECTION_JURICA_RAW,
  BATCH_MAX_DECISIONS_CA,
  BATCH_MAX_DECISIONS_TJ,
  BATCH_MAX_DECISIONS_TCOM,
  BATCH_MAX_DECISIONS_CPH,
  BATCH_MAX_DECISIONS_JURICAV2,
  COLLECTION_JURICAV2_RAW
} = process.env
