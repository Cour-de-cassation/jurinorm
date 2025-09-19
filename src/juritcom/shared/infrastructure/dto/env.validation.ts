import * as Joi from 'joi'

export const envValidationConfig = {
  cache: true,
  validationSchema: Joi.object({
    DOC_LOGIN: Joi.string().required(),
    DOC_PASSWORD: Joi.string().required(),
    USE_AUTH: Joi.string().required(),
    S3_URL: Joi.string().required(),
    S3_ACCESS_KEY: Joi.string().required(),
    S3_SECRET_KEY: Joi.string().required(),
    S3_REGION: Joi.string().required(),
    S3_BUCKET_NAME_RAW: Joi.string().required(),
    S3_BUCKET_NAME_PDF: Joi.string().required(),
    S3_BUCKET_NAME_PDF2TEXT_SUCCESS: Joi.string().required(),
    S3_BUCKET_NAME_PDF2TEXT_FAILED: Joi.string().required(),
    S3_BUCKET_NAME_DELETION: Joi.string().required(),
    S3_BUCKET_NAME_DELETION_PROCESSED: Joi.string().required(),
    S3_BUCKET_NAME_NORMALIZED: Joi.string().required(),
    NLP_PSEUDONYMISATION_API_URL: Joi.string().required(),
    DBSDER_API_URL: Joi.string().required(),
    DBSDER_API_KEY: Joi.string()
      .required()
      .guid({
        version: ['uuidv4'],
        separator: true
      }),
    DBSDER_OTHER_API_KEY: Joi.string()
      .required()
      .guid({
        version: ['uuidv4'],
        separator: true
      }),
    DBSDER_POWERFUL_API_KEY: Joi.string()
      .required()
      .guid({
        version: ['uuidv4'],
        separator: true
      }),
    ZONING_API_URL: Joi.string().required()
  })
}
