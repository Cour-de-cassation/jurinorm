import { Type } from 'class-transformer'
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
import { MockUtils } from '../utils/mock.utils'
import { TypePartieExhaustive, QualitePartieExhaustive, SuiviOccultation } from 'dbsder-api-types'
import "reflect-metadata";


const metadonneesDtoExample = new MockUtils().allAttributesMetadonneesDtoMock

export class PresidentDto {
  @IsString()
  fonction: string

  @IsString()
  nom: string

  @IsString()
  prenom: string

  @IsString()
  civilite: string
}

export class DecisionAssocieeDto {
  @IsString()
  @Length(1, 1)
  numeroRegistre: string

  @IsString()
  @Matches('^[0-9]{2}/[0-9]{5}$')
  numeroRoleGeneral: string

  @IsString()
  @Matches('^TJ[0-9A-Z]{5}$')
  idJuridiction: string

  @IsString()
  @Matches('^[0-9]{8}$')
  @IsDateString()
  date: string

  @IsString()
  @IsOptional()
  idDecision?: string
}

export class PartieDto {
  @IsEnum(TypePartieExhaustive)
  type: TypePartieExhaustive

  @IsString()
  nom: string

  @IsString()
  @IsOptional()
  prenom?: string

  @IsString()
  @IsOptional()
  civilite?: string

  @IsEnum(QualitePartieExhaustive)
  @IsOptional()
  qualite?: QualitePartieExhaustive
}

export class MetadonneesDto {
  @IsString()
  @Length(2, 42)
  nomJuridiction: string

  @IsString()
  @Matches('^TJ[0-9A-Z]{5}$')
  idJuridiction: string

  @IsOptional()
  @IsString()
  codeJuridiction?: string

  @IsString()
  @Length(1, 1)
  numeroRegistre: string

  @IsString()
  @Matches('^[0-9]{2}/[0-9]{5}$')
  numeroRoleGeneral: string

  @IsString({ each: true })
  @Length(10, 10, { each: true })
  @IsOptional()
  numeroMesureInstruction?: string[]

  @IsString()
  @Matches('^.{2}$')
  codeService: string

  @IsString()
  @Length(0, 25)
  libelleService: string

  @IsString()
  @Matches('^[0-9]{8}$')
  @IsDateString()
  dateDecision: string

  @IsString()
  @Matches('^[0-9a-zA-Z]{3}$')
  codeDecision: string

  @IsString()
  @Length(0, 200)
  libelleCodeDecision: string

  @IsDefined()
  @IsOptional()
  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => PresidentDto)
  president?: PresidentDto

  @IsOptional()
  @IsDefined()
  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => DecisionAssocieeDto)
  decisionAssociee?: DecisionAssocieeDto

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PartieDto)
  parties?: PartieDto[]

  @IsString()
  @IsOptional()
  sommaire?: string

  @IsString()
  @Matches('^[0-9a-zA-Z]{3}$')
  codeNAC: string

  @IsString()
  libelleNAC: string

  @IsOptional()
  @IsString()
  @Matches('^[0-9a-zA-Z ]{0,2}$')
  codeNature?: string

  @IsOptional()
  @IsString()
  libelleNature?: string

  @IsBoolean()
  decisionPublique: boolean

  @IsEnum(SuiviOccultation)
  recommandationOccultation: SuiviOccultation

  @IsString()
  @IsOptional()
  occultationComplementaire?: string

  @IsBoolean()
  selection: boolean

  @IsBoolean()
  matiereDeterminee: boolean

  @IsBoolean()
  pourvoiLocal: boolean

  @IsBoolean()
  pourvoiCourDeCassation: boolean

  @IsBoolean()
  debatPublic: boolean

  @IsString()
  @IsOptional()
  idDecision?: string

  @IsBoolean()
  @IsOptional()
  indicateurQPC?: boolean
}
