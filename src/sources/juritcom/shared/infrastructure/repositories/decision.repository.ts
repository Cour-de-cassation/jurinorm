export interface DecisionRepository {
  saveDataDecisionIntegre(
    jsonToString: string,
    originalPdfFileName: string,
    jsonS3Key: string
  ): Promise<void>

  deleteDataDecisionIntegre(jsonS3Key: string): Promise<void>

  uploadFichierDecisionIntegre(
    fichierDecisionIntegre: Express.Multer.File | Buffer,
    originalPdfFileName: string,
    pdfS3Key: string
  ): Promise<void>
}
