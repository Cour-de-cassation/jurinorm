import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import * as fs from 'fs'

@Injectable()
export class FileService {
  private readonly uploadPath = process.env.AV_PDF_PATH
  private readonly logger = new Logger(FileService.name)

  constructor() {
    if (!fs.existsSync(this.uploadPath)) {
      this.logger.warn({
        operationName: FileService.name,
        msg: `AV_PDF_PATH ${this.uploadPath} not found or volume does not exist`
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
      this.logger.error({
        operationName: FileService.name,
        msg: error.message
      })
      throw error
    }
  }
}
