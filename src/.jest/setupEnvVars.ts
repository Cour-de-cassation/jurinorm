process.env = {
  //Commun
  NODE_ENV: "development",

  DBSDER_API_URL: "http://host.docker.internal:3008", //to docker use host.docker.internal over localhost
  DBSDER_API_KEY: "9ad44ab5-3416-4989-90a6-3cfe972175de",

  NLP_PSEUDONYMISATION_API_URL: "http://host.docker.internal:8081", //to docker use host.docker.internal over localhost
  ZONING_API_URL: "http://host.docker.internal:8090", //to docker use host.docker.internal over localhost

  S3_URL: "http://host.docker.internal:9000", //to docker use host.docker.internal over localhost
  S3_ACCESS_KEY: "local_access_key",
  S3_SECRET_KEY: "local_secret_key",
  S3_REGION: "eu-west-paris-1",

  NORMALIZATION_BATCH_SCHEDULE: "'0 0 * * 0'", //Tous les dimanches à minuit


  //TJ
  S3_BUCKET_NAME_RAW_TJ: "juritj-test-bucket-raw",
  S3_BUCKET_NAME_NORMALIZED_TJ: "juritj-test-bucket-normalized",


  //TCOM
  S3_BUCKET_NAME_RAW_TCOM: "juritcom-test-bucket-raw",
  S3_BUCKET_NAME_PDF: "juritcom-archive-pdf",
  S3_BUCKET_NAME_DELETION: "juritcom-deletion-bucket",
  S3_BUCKET_NAME_NORMALIZED_TCOM: "juritcom-test-bucket-normalized",
  S3_BUCKET_NAME_PDF2TEXT_FAILED: "juritcom-archive-pdf2text-failed",
  S3_BUCKET_NAME_PDF2TEXT_SUCCESS: "juritcom-archive-pdf2text-success",
  PLAINTEXT_SOURCE: "'nlp'",
  DBSDER_OTHER_API_KEY: "9ad44ab5-3416-4989-90a6-3cfe972175de",
  AV_PDF_PATH: "./AV_PDF_PATH",

  //CPH
  FILE_DB_URL: "mongodb://host.docker.internal:55433/rawfiles",
  S3_BUCKET_NAME_PORTALIS: "portalis-collect-test-bucket",
}
