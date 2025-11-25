import { RawFile } from 'src/services/eventSourcing'
import { MetadonneesDto } from '../../shared/infrastructure/dto/metadonnees.dto'

export type RawTj = RawFile<MetadonneesDto>
