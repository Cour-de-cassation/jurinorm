import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { logger } from '../../../../../config/logger'
import * as fs from 'fs'

@Injectable()
export class FileService {
  private readonly uploadPath = process.env.AV_PDF_PATH

  constructor() {
    if (!fs.existsSync(this.uploadPath)) {
      logger.warn({
        operations: ['other', `${FileService.name}`],
        path: 'src/sources/juritcom/shared/infrastructure/files/file.service.ts',
        message: `AV_PDF_PATH ${this.uploadPath} not found or volume does not exist`
      })
    }
  }

  saveFile(file: Express.Multer.File, uniqueFilename: string): { filename: string; path: string } {
    try {
      const fullPath = `${this.uploadPath}/${uniqueFilename}`

      fs.writeFileSync(fullPath, file.buffer)

      return {
        filename: uniqueFilename,
        path: fullPath
      }
    } catch (_error) {
      const error = new InternalServerErrorException('Error saving file')
      logger.error({
        operations: ['other', `${FileService.name}`],
        path: 'src/sources/juritcom/shared/infrastructure/files/file.service.ts',
        message: error.message
      })
      throw error
    }
  }
}
