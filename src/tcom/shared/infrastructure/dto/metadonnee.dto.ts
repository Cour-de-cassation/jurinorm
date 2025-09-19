import { ApiProperty, ApiPropertyOptional, ApiHideProperty } from '@nestjs/swagger'
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
  @ApiPropertyOptional({
    description: 'Fonction',
    enum: JusticeFunctionTcom,
    example: JusticeFunctionTcom.GRF
  })
  @IsEnum(JusticeFunctionTcom)
  @IsOptional()
  fonction?: JusticeFunctionTcom

  @ApiProperty({
    description: 'Nom',
    type: String,
    example: 'Dupond'
  })
  @IsString()
  nom: string

  @ApiPropertyOptional({
    description: 'Prénom',
    type: String,
    example: 'Henry'
  })
  @IsString()
  @IsOptional()
  prenom?: string

  @ApiPropertyOptional({
    description: 'Civilité',
    type: String,
    example: 'Monsieur'
  })
  @IsString()
  @IsOptional()
  civilite?: string
}

export class AdresseDto {
  @ApiPropertyOptional({
    description: "Numéro d'adresse",
    type: String,
    example: '20bis'
  })
  @IsString()
  @IsOptional()
  numero?: string

  @ApiPropertyOptional({
    description: "Type de voie d'adresse",
    type: String,
    example: 'rue'
  })
  @IsString()
  @IsOptional()
  type?: string

  @ApiPropertyOptional({
    description: "Voie d'adresse",
    type: String,
    example: 'du Bourg'
  })
  @IsString()
  @IsOptional()
  voie?: string

  @ApiPropertyOptional({
    description: 'Code postal',
    type: String,
    example: '39100'
  })
  @IsString()
  @IsOptional()
  codePostal?: string

  @ApiPropertyOptional({
    description: 'Pays',
    type: String,
    example: 'France'
  })
  @IsString()
  @IsOptional()
  pays?: string

  @ApiPropertyOptional({
    description: 'Localité',
    type: String,
    example: 'Dole'
  })
  @IsString()
  @IsOptional()
  localite?: string

  @ApiPropertyOptional({
    description: "Complement d'adresse",
    type: String,
    example: "Complement d'adresse"
  })
  @IsString()
  @IsOptional()
  complement?: string

  @ApiPropertyOptional({
    description: 'Bureau distributeur',
    type: String,
    example: 'Bureau distributeur'
  })
  @IsString()
  @IsOptional()
  bureau?: string
}

export class PartieDto {
  @ApiProperty({
    description: 'Type du partie de la décision',
    enum: TypePartieExhaustive,
    example: TypePartieExhaustive.PP
  })
  @IsEnum(TypePartieExhaustive)
  type: TypePartieExhaustive

  @ApiProperty({
    description: 'Rôle de la partie',
    enum: JusticeRoleTcom,
    example: JusticeRoleTcom.AVOCAT
  })
  @IsEnum(JusticeRoleTcom)
  role: JusticeRoleTcom

  @ApiProperty({
    description: 'Nom de la partie (ou nom et prénom)',
    type: String,
    example: 'Dupond'
  })
  @IsString()
  nom: string

  @ApiPropertyOptional({
    description: "Nom d'usage de la partie",
    type: String,
    example: 'Nom usage'
  })
  @IsString()
  @IsOptional()
  nomUsage?: string

  @ApiPropertyOptional({
    description: 'Prénom de la partie',
    type: String,
    example: 'Julien'
  })
  @IsString()
  @IsOptional()
  prenom?: string

  @ApiPropertyOptional({
    description: 'Alias de la partie',
    type: String,
    example: 'Jul'
  })
  @IsString()
  @IsOptional()
  alias?: string

  @ApiPropertyOptional({
    description: 'Autre prénom de la partie',
    type: String,
    example: 'Alain Patrick'
  })
  @IsString()
  @IsOptional()
  prenomAutre?: string

  @ApiPropertyOptional({
    description: 'Civilité de la partie',
    type: String,
    example: 'Monsieur'
  })
  @IsString()
  @IsOptional()
  civilite?: string

  @ApiProperty({
    description: 'Qualité du partie de la décision',
    enum: QualitePartieExhaustive,
    example: QualitePartieExhaustive.I
  })
  @IsEnum(QualitePartieExhaustive)
  qualite: QualitePartieExhaustive

  @ApiPropertyOptional({
    description: 'Adresse',
    type: AdresseDto,
    example: {
      numero: '20bis',
      type: 'rue',
      voie: 'du Bourg',
      codePostal: '39100',
      localite: 'Dole'
    }
  })
  @IsOptional()
  @IsDefined()
  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => AdresseDto)
  adresse?: AdresseDto
}

export class OccultationComplementaireDto {
  @ApiProperty({
    description: 'Personne morale',
    type: Boolean,
    example: true
  })
  @IsBoolean()
  personneMorale: boolean

  @ApiProperty({
    description: 'Personne physico-morale géo-morale',
    type: Boolean,
    example: false
  })
  @IsBoolean()
  personnePhysicoMoraleGeoMorale: boolean

  @ApiProperty({
    description: 'Adresse',
    type: Boolean,
    example: true
  })
  @IsBoolean()
  adresse: boolean

  @ApiProperty({
    description: 'Date civile',
    type: Boolean,
    example: false
  })
  @IsBoolean()
  dateCivile: boolean

  @ApiProperty({
    description: "Plaque d'immatriculation",
    type: Boolean,
    example: true
  })
  @IsBoolean()
  plaqueImmatriculation: boolean

  @ApiProperty({
    description: 'Cadastre',
    type: Boolean,
    example: false
  })
  @IsBoolean()
  cadastre: boolean

  @ApiProperty({
    description: 'Chaine numéro identifiante',
    type: Boolean,
    example: false
  })
  @IsBoolean()
  chaineNumeroIdentifiante: boolean

  @ApiProperty({
    description: 'Coordonnée éléctronique',
    type: Boolean,
    example: true
  })
  @IsBoolean()
  coordonneeElectronique: boolean

  @ApiProperty({
    description: 'Professionnel Magistrat/Gréffier',
    type: Boolean,
    example: false
  })
  @IsBoolean()
  professionnelMagistratGreffier: boolean

  @ApiProperty({
    description: 'Motifs des débats de la chambre du conseil',
    type: Boolean,
    example: true
  })
  @IsBoolean()
  motifsDebatsChambreConseil: boolean

  @ApiProperty({
    description: "Motifs du secret d'affaires",
    type: Boolean,
    example: false
  })
  @IsBoolean()
  motifsSecretAffaires: boolean

  @ApiPropertyOptional({
    description: 'Conserver élément',
    type: String,
    example: '#dateCivile|automobile'
  })
  @IsString()
  @IsOptional()
  conserverElement?: string

  @ApiPropertyOptional({
    description: 'Supprimer élément',
    type: String,
    example: '#magistratGreffe|120.000€'
  })
  @IsString()
  @IsOptional()
  supprimerElement?: string
}

export class MetadonneeDto {
  @ApiProperty({
    description: 'Identifiant de la décision dans le système source TCOM',
    type: String,
    example: '66177ce6e5d'
  })
  @IsString()
  idDecision: string

  @ApiProperty({
    description: 'Identifiant unique du groupement émetteur',
    type: String,
    example: 'ABDC'
  })
  @IsString()
  @Length(1, 4)
  idGroupement: string

  @ApiProperty({
    description:
      'Identifiant de la juridiction émettrice propre au système d’information originel. Au format ^[0-9]{4}$',
    type: String,
    example: '7500'
  })
  @IsString()
  @Matches('^[0-9]{4}$')
  idJuridiction: string

  @ApiProperty({
    description: 'Intitulé complet de la juridiction émettrice',
    type: String,
    example: 'Tribunal de commerce de Paris'
  })
  @IsString()
  @Length(2, 42)
  libelleJuridiction: string

  @ApiProperty({
    description: 'Date de rendu de la décision. Au format : AAAAMMJJ',
    type: String,
    example: '20240322'
  })
  @IsString()
  @Matches('^[0-9]{8}$')
  @IsDateString()
  dateDecision: string

  @ApiProperty({
    description: 'Numéro du dossier associée à la décision rendue',
    type: String,
    example: '2021F00123'
  })
  @IsString()
  @Length(1, 20)
  numeroDossier: string

  @ApiPropertyOptional({
    description: 'Identifiant unique de la chambre de la juridiction émettrice',
    type: String,
    example: 'ID'
  })
  @IsString()
  @IsOptional()
  idChambre?: string

  @ApiPropertyOptional({
    description: 'Intitulé complet de la chambre de la juridiction émettrice',
    type: String,
    example: 'libelleChambre'
  })
  @IsString()
  @IsOptional()
  libelleChambre?: string

  @ApiPropertyOptional({
    description: 'Identifiant unique ou code relatif au fond de la décision',
    type: String,
    example: 'code matière de la décision'
  })
  @IsString()
  @IsOptional()
  idMatiere?: string

  @ApiPropertyOptional({
    description: 'Intitulé complet relatif au fond de la décision',
    type: String,
    example: "Demande de nullité d'un bail"
  })
  @IsString()
  @IsOptional()
  libelleMatiere?: string

  @ApiPropertyOptional({
    description: 'Identifiant unique ou code relatif au type de procédure',
    type: String,
    example: 'CODETYPEPROCEDURE'
  })
  @IsString()
  @IsOptional()
  idProcedure?: string

  @ApiPropertyOptional({
    description: 'Intitulé complet relatif au type de procédure',
    type: String,
    example: 'Libellé type affaire '
  })
  @IsString()
  @IsOptional()
  libelleProcedure?: string

  @ApiProperty({
    description: 'Caractère public de la décision',
    type: Boolean,
    example: true
  })
  @IsBoolean()
  decisionPublique: boolean

  @ApiProperty({
    description: 'Caractère non public des débats précédant la décision',
    type: Boolean,
    example: false
  })
  @IsBoolean()
  debatChambreDuConseil: boolean

  @ApiProperty({
    description: 'caractère "d\'intérêt particulier" de la décision',
    type: Boolean,
    example: false
  })
  @IsBoolean()
  interetParticulier: boolean

  @ApiProperty({
    description: 'Liste des compositions de la décision',
    type: [CompositionDto],
    example: [
      {
        fonction: 'GRF',
        nom: 'Dupond',
        prenom: 'Henry',
        civilite: 'Monsieur'
      }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompositionDto)
  @IsOptional()
  composition?: CompositionDto[]

  @ApiProperty({
    description: 'Liste des parties de la décision',
    type: [PartieDto],
    example: [
      {
        type: TypePartieExhaustive.PP,
        role: 'PARTIE',
        nom: 'Dupond',
        prenom: 'Julien',
        civilite: 'Monsieur',
        qualite: QualitePartieExhaustive.I,
        adresse: {
          numero: '20bis',
          type: 'rue',
          voie: 'du Bourg',
          codePostal: '39100',
          localite: 'Dole'
        }
      }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartieDto)
  @IsOptional()
  parties?: PartieDto[]

  @ApiProperty({
    description: 'Occultations complémentaires',
    type: OccultationComplementaireDto,
    example: {
      personneMorale: true,
      personnePhysicoMoraleGeoMorale: false,
      adresse: true,
      dateCivile: false,
      plaqueImmatriculation: true,
      cadastre: false,
      chaineNumeroIdentifiante: false,
      coordonneeElectronique: true,
      professionnelMagistratGreffier: false,
      motifsDebatsChambreConseil: true,
      motifsSecretAffaires: false,
      conserverElement: '#dateCivile|automobile',
      supprimerElement: '#magistratGreffe|120.000€'
    }
  })
  @IsDefined()
  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => OccultationComplementaireDto)
  @IsOptional()
  occultationsComplementaires?: OccultationComplementaireDto

  @ApiHideProperty()
  @IsOptional()
  date?: any
}
