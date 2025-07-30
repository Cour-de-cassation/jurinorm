import dotenv from 'dotenv'
import { MissingValue } from './error'

if (!process.env.NODE_ENV) dotenv.config()

if (process.env.ZONING_API_URL == null) throw new MissingValue('process.env.ZONING_API_URL')
if (process.env.NLP_API_URL == null) throw new MissingValue('process.env.NLP_API_URL')
if (process.env.DBSDER_API_URL == null) throw new MissingValue('process.env.DBSDER_API_URL')
if (process.env.DBSDER_API_KEY == null) throw new MissingValue('process.env.DBSDER_API_KEY')
if (process.env.REDIS_HOST == null) throw new MissingValue('process.env.REDIS_HOST')
if (process.env.REDIS_PASSWORD == null) throw new MissingValue('process.env.REDIS_PASSWORD')
if (process.env.REDIS_DB == null) throw new MissingValue('process.env.REDIS_DB')
if (process.env.COLLECT_API_KEY == null) throw new MissingValue('process.env.COLLECT_API_KEY')

export const {
  NODE_ENV = 'development',
  PORT = 3003,
  ZONING_API_URL,
  DBSDER_API_URL,
  DBSDER_API_KEY,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_DB,
  COLLECT_API_KEY
} = process.env
