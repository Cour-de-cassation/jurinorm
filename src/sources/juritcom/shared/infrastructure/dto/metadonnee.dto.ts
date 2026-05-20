import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsEnum,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested
} from 'class-validator'
import { Type } from 'class-transformer'
import {
  JusticeFunctionTcom,
  JusticeRoleTcom,
  QualitePartieExhaustive,
  TypePartieExhaustive
} from 'dbsder-api-types'

// Qualité du partie de la décision

export class CompositionDto {
  @IsEnum(JusticeFunctionTcom)
  @IsOptional()
  fonction?: JusticeFunctionTcom

  @IsString()
  nom: string

  @IsString()
  @IsOptional()
  prenom?: string

  @IsString()
  @IsOptional()
  civilite?: string
}

export class AdresseDto {
  @IsString()
  @IsOptional()
  numero?: string

  @IsString()
  @IsOptional()
  type?: string

  @IsString()
  @IsOptional()
  voie?: string

  @IsString()
  @IsOptional()
  codePostal?: string

  @IsString()
  @IsOptional()
  pays?: string

  @IsString()
  @IsOptional()
  localite?: string

  @IsString()
  @IsOptional()
  complement?: string

  @IsString()
  @IsOptional()
  bureau?: string
}

export class PartieDto {
  @IsEnum(TypePartieExhaustive)
  type: TypePartieExhaustive

  @IsEnum(JusticeRoleTcom)
  role: JusticeRoleTcom

  @IsString()
  nom: string

  @IsString()
  @IsOptional()
  nomUsage?: string

  @IsString()
  @IsOptional()
  prenom?: string

  @IsString()
  @IsOptional()
  alias?: string

  @IsString()
  @IsOptional()
  prenomAutre?: string

  @IsString()
  @IsOptional()
  civilite?: string

  @IsEnum(QualitePartieExhaustive)
  qualite: QualitePartieExhaustive

  @IsOptional()
  @IsDefined()
  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => AdresseDto)
  adresse?: AdresseDto
}

export class OccultationComplementaireDto {
  @IsBoolean()
  personneMorale: boolean

  @IsBoolean()
  personnePhysicoMoraleGeoMorale: boolean

  @IsBoolean()
  adresse: boolean

  @IsBoolean()
  dateCivile: boolean

  @IsBoolean()
  plaqueImmatriculation: boolean

  @IsBoolean()
  cadastre: boolean

  @IsBoolean()
  chaineNumeroIdentifiante: boolean

  @IsBoolean()
  coordonneeElectronique: boolean

  @IsBoolean()
  professionnelMagistratGreffier: boolean

  @IsBoolean()
  motifsDebatsChambreConseil: boolean

  @IsBoolean()
  motifsSecretAffaires: boolean

  @IsString()
  @IsOptional()
  conserverElement?: string

  @IsString()
  @IsOptional()
  supprimerElement?: string
}

export class MetadonneeDto {
  @IsString()
  idDecision: string

  @IsString()
  @Length(1, 4)
  idGroupement: string

  @IsString()
  @Matches('^[0-9]{4}$')
  idJuridiction: string

  @IsString()
  @Length(2, 42)
  libelleJuridiction: string

  @IsString()
  @Matches('^[0-9]{8}$')
  @IsDateString()
  dateDecision: string

  @IsString()
  @Length(1, 20)
  numeroDossier: string

  @IsString()
  @IsOptional()
  idChambre?: string

  @IsString()
  @IsOptional()
  libelleChambre?: string

  @IsString()
  @IsOptional()
  idMatiere?: string

  @IsString()
  @IsOptional()
  libelleMatiere?: string

  @IsString()
  @IsOptional()
  idProcedure?: string

  @IsString()
  @IsOptional()
  libelleProcedure?: string

  @IsBoolean()
  decisionPublique: boolean

  @IsBoolean()
  debatChambreDuConseil: boolean

  @IsBoolean()
  interetParticulier: boolean

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompositionDto)
  @IsOptional()
  composition?: CompositionDto[]

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartieDto)
  @IsOptional()
  parties?: PartieDto[]

  @IsDefined()
  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => OccultationComplementaireDto)
  @IsOptional()
  occultationsComplementaires?: OccultationComplementaireDto

  @IsOptional()
  date?: any
}
