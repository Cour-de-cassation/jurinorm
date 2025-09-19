import dotenv from 'dotenv'
import { MissingValue } from './error'

// if (!process.env.NODE_ENV) dotenv.config()

if (process.env.DBSDER_API_KEY == null)
  throw new MissingValue("process.env.DBSDER_API_KEY");
if (process.env.DBSDER_API_URL == null)
  throw new MissingValue("process.env.DBSDER_API_URL");
if (process.env.FILE_DB_URL == null)
  throw new MissingValue('process.env.FILE_DB_URL')
if (process.env.NLP_PSEUDONYMISATION_API_URL == null)
  throw new MissingValue("process.env.NLP_PSEUDONYMISATION_API_URL");
if (process.env.NODE_ENV == null)
  throw new MissingValue("process.env.NODE_ENV");
if (process.env.S3_ACCESS_KEY == null)
  throw new MissingValue("process.env.S3_ACCESS_KEY");
if (process.env.S3_BUCKET_NAME_PORTALIS == null)
  throw new MissingValue("process.env.S3_BUCKET_NAME_PORTALIS");
if (process.env.S3_REGION == null)
  throw new MissingValue("process.env.S3_REGION");
if (process.env.S3_SECRET_KEY == null)
  throw new MissingValue("process.env.S3_SECRET_KEY");
if (process.env.S3_URL == null)
  throw new MissingValue("process.env.S3_URL");

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
  S3_URL
} = process.env
