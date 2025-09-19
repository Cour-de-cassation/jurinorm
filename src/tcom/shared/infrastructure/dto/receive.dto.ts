import { ApiProperty } from '@nestjs/swagger'
import { MetadonneeDto } from './metadonnee.dto'
import { IsString } from 'class-validator'

export class ReceiveDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Décision intègre au format PDF.'
  })
  fichierDecisionIntegre: Express.Multer.File

  @ApiProperty({
    description: 'Texte de la décision intègre',
    type: String,
    example: 'Texte de la décision'
  })
  @IsString()
  texteDecisionIntegre: string

  @ApiProperty({
    description: 'Metadonnées associées à la décision intègre.'
  })
  metadonnees: MetadonneeDto
}

export class bucketFileDto {
  jsonFileName: string
  pdfFileName: string
}
