import { RawFile } from '../../../services/eventSourcing'
import { MetadonneesDto } from '../../shared/infrastructure/dto/metadonnees.dto'

export type RawTj = RawFile<MetadonneesDto>
