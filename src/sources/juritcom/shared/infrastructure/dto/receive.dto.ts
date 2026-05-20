import { MetadonneeDto } from './metadonnee.dto'
import { IsString } from 'class-validator'

export class ReceiveDto {
  fichierDecisionIntegre: Express.Multer.File

  @IsString()
  texteDecisionIntegre: string

  metadonnees: MetadonneeDto
}

export class bucketFileDto {
  jsonFileName: string
  pdfFileName: string
}
