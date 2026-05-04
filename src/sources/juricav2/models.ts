import zod from 'zod'
import {
  CategoriesToOmit,
  CodeNac,
  LabelStatus,
  PublishStatus,
  SuiviOccultation,
  UnIdentifiedDecisionCaV2
} from 'dbsder-api-types'
import { RawFile } from '../../services/eventSourcing'
import { zObjectId } from 'zod-mongodb-schema'

export function occultationRecommendationCodeNac(
  recommandationOccultation: SuiviOccultation
): CategoriesToOmit {
  if (
    recommandationOccultation === SuiviOccultation.COMPLEMENT ||
    recommandationOccultation === SuiviOccultation.CONFORME
  ) {
    return CategoriesToOmit.SUIVI
  } else {
    return CategoriesToOmit.NON_SUIVI
  }
}

const zDecisionAttaquee = zod.object({
  type_juridiction: zod.string().nullable(),
  ville: zod.string().nullable(),
  date: zod.string().nullable()
})

const zParty = zod.object({
  identite: zod.string().optional(),
  qualite_partie: zod.string().optional(),
  type_personne: zod.string().optional()
})

const schemaJuricaMetadata = zod.object({
  _id: zObjectId,
  numero_rg: zod.string().trim().min(1).max(40).describe('Numéro RG'),
  numero_registre: zod
    .string()
    .trim()
    .max(40)
    .nullable()
    .describe('Numéro de registre')
    .default(null),
  date_decision: zod.iso.date().describe('Date de la décision'),
  juridiction_code: zod.string().trim().min(1).max(10).describe('Code de la juridiction'),
  autorite_code: zod
    .string()
    .trim()
    .max(10)
    .nullable()
    .describe("Code de l'autorité")
    .default(null),
  autorite_label: zod
    .string()
    .trim()
    .max(400)
    .nullable()
    .describe("Libellé de l'autorité")
    .default(null),
  code_juridiction_detail: zod
    .string()
    .max(100)
    .nullable()
    .describe('Code juridiction détaillé')
    .default(null),
  code_nac: zod.string().trim().min(1).max(3).describe('Code NAC'),
  code_nac_partie: zod.string().max(2).nullable().describe('Code NAC partie').default(null),
  composition_tribunal: zod
    .string()
    .max(200)
    .nullable()
    .describe('Composition de la juridiction')
    .default(null),
  created_at: zod.date().describe('Date de création dans MongoDB'),
  decision_attaquee: zDecisionAttaquee.nullable().describe('Décision attaquée').default(null),
  decision_code: zod.string().max(10).describe('Code de la décision'),
  decision_label: zod.string().max(1000).describe('Libellé de la décision'),
  fichier_archive: zod.string().max(400).nullable().describe("Fichier d'archive").default(null),
  has_pourvoi_cassation: zod.boolean().optional().describe('Pourvoi en cassation'),
  has_pourvoi_local: zod.boolean().optional().describe('Pourvoi local'),
  html_source: zod.string().trim().min(1).describe('HTML source from Oracle'),
  is_debat_public: zod.boolean().optional().describe('Indicateur de débat public'),
  is_decision_publique: zod.boolean().optional().describe('Indicateur de décision publique'),
  is_matiere_determinee: zod.boolean().optional().describe('Matière déterminée'),
  is_qpc: zod.boolean().optional().describe('Indicateur QPC'),
  is_selected: zod.boolean().optional().describe('Décision sélectionnée'),
  juridiction_name: zod.string().trim().min(1).max(200).describe('Nom de la juridiction'),
  label_nac: zod.string().max(4000).nullable().describe('Libellé NAC').default(null),
  label_nac_partie: zod.string().max(1000).nullable().describe('Libellé NAC partie').default(null),
  notes_administratives: zod
    .string()
    .max(4000)
    .nullable()
    .describe('Notes administratives')
    .default(null),
  notice_format: zod.string().max(1).nullable().describe('Format de la notice').default(null),
  numero_portalis: zod.string().nullable().optional().describe('Numéro Portalis'),
  occultation_complementaire: zod
    .number()
    .min(0)
    .max(3)
    .nullable()
    .describe('Occultation complémentaire')
    .default(null),
  occultation_complementaire_libre: zod
    .string()
    .nullable()
    .describe('Occultation complémentaire libre')
    .default(null),
  oracle_id: zod
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .describe('Identifiant unique de la décision (from Oracle)'),
  parties: zod.array(zParty).default([]).describe('Parties'),
  sommaire: zod.string().max(4000).nullable().describe('Sommaire de la décision').default(null),
  updated_at: zod.date().describe('Date de dernière mise à jour dans MongoDB'),
  pourvoi_case_number: zod.string().optional().describe('Numéro de pourvoi en cassation'),
  pourvoi_cassation_status: zod
    .enum(['terminé', 'en_cours_instruction'])
    .optional()
    .describe('Statut du pourvoi en cassation')
})

export type JuricaMetadata = zod.infer<typeof schemaJuricaMetadata>

/* @TODO ???
function computeAdditionalTerms(pseudoRules: JuricaMetadata['recommandationOccultation']): string { 
  return pseudoRules.elementsAOcculter.map((_) => `+${_}`).join('|')
}
*/

export function mapJuricaDecision(
  data: JuricaMetadata,
  content: string,
  occultationStrategy: Required<Pick<CodeNac, 'blocOccultation' | 'categoriesToOmit'>>,
  filenameSource: string
): UnIdentifiedDecisionCaV2 {
  /* @TOD ???
  const recommandationOccultation = publicationRules.recommandationOccultation
    .suiviRecommandationOccultation
    ? SuiviOccultation.CONFORME
    : SuiviOccultation.AUCUNE
  */

  return {
    sourceId: data._id.toHexString(),
    sourceName: 'juricav2',
    originalText: content,
    labelStatus: LabelStatus.TOBETREATED,
    publishStatus: PublishStatus.TOBEPUBLISHED,
    dateCreation: new Date().toISOString(),
    dateDecision: new Date(data.date_decision).toISOString(),
    NACCode: data.code_nac,
    NACLibelle: data.label_nac,
    endCaseCode: data.decision_code,
    libelleEndCaseCode: data.decision_label,
    jurisdictionCode: data.code_juridiction_detail, // attention à la confusion possible
    jurisdictionId: data.juridiction_code, // attention à la confusion possible
    jurisdictionName: data.juridiction_name,
    selection: data.is_selected,
    sommaire: data.sommaire,
    /* @TODO ???
    blocOccultation: occultationStrategy.blocOccultation,
    occultation: {
      additionalTerms: computeAdditionalTerms(publicationRules.recommandationOccultation),
      categoriesToOmit:
        occultationStrategy.categoriesToOmit[
          occultationRecommendationCodeNac(recommandationOccultation)
        ],
      motivationOccultation: false
    },
    recommandationOccultation,
    */
    // formation: @TODO ???
    parties: [], // @TODO: which values from data.parties ???
    composition: data.composition_tribunal,
    // tiers: @TODO ???
    public: data.is_decision_publique,
    debatPublic: data.is_debat_public,
    pourvoiCourDeCassation: data.has_pourvoi_cassation,
    pourvoiLocal: data.has_pourvoi_local,
    filenameSource: data.fichier_archive
  }
}

export type RawJurica = RawFile<JuricaMetadata>

const utcDateSchema = zod.iso.date().transform((val) => new Date(val))
export const parseStatusQuery = zod.object({
  from_date: utcDateSchema,
  from_id: zod.string().optional()
}).safeParse
