import { ApiProperty, ApiHideProperty } from '@nestjs/swagger'
import { MetadonneeDto } from './metadonnee.dto'

export class CollectDto {
  @ApiProperty({
    description: 'Texte intègre de la décision.'
  })
  texteDecisionIntegre: string

  @ApiProperty({
    description: 'Metadonnées associées à la décision intègre.'
  })
  metadonnees: MetadonneeDto

  @ApiHideProperty()
  date: Date
}
