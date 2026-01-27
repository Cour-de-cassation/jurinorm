import zod from 'zod'
import {
  UnIdentifiedDecisionCph,
  LabelStatus,
  PublishStatus,
  SuiviOccultation,
  CodeNac
} from 'dbsder-api-types'
import { RawFile } from '../../eventSourcing'

////////////////////////
// TYPES DECLARATIONS
////////////////////////

export type FileCph = {
  mimetype: string
  size: number
  buffer: Buffer
}

const schemaPublicationRules = zod.object({
  identifiantDecision: zod.string().trim().min(1),
  recommandationOccultation: zod.object({
    suiviRecommandationOccultation: zod.boolean(),
    elementsAOcculter: zod.array(zod.string())
  }),
  interetParticulier: zod.boolean(),
  sommaireInteretParticulier: zod.string().optional()
})

const schemaCphMetadatas = zod.object({
  audiences_dossier: zod
    .object({
      audience_dossier: zod.array(
        zod.object({
          formation: zod.string().optional(),
          chronologie: zod.string().optional()
        })
      )
    })
    .optional(),
  decision: zod.object({
    date: zod.string().regex(/\d{8}/),
    codes_decision: zod.object({
      code_decision: zod
        .array(
          zod.object({
            code: zod.string(),
            libelle: zod.string()
          })
        )
        .min(1)
    })
  }),
  dossier: zod.object({
    nature_affaire_civile: zod.object({
      code: zod.string(),
      libelle: zod.string()
    })
  }),
  evenement_porteur: zod.object({
    caracteristiques: zod.object({
      caracteristique: zod.array(
        zod.object({
          mnemo: zod.string(),
          libelle: zod.string(),
          valeur: zod.unknown()
        })
      )
    }),
    srj_code_evt: zod.string()
  }),
  juridiction: zod.object({
    libelle_court: zod.string(),
    libelle_long: zod.string(),
    code_srj: zod.string()
  })
})

const schemaRawCph = schemaCphMetadatas.and(schemaPublicationRules)
export type RawCph = RawFile<zod.infer<typeof schemaRawCph>>

export function isRawCph(x: unknown): x is RawCph {
  if (!(typeof x === 'object') || !('metadatas' in x)) return false
  const { success, data } = schemaRawCph.safeParse(x.metadatas)
  return success && data.juridiction.libelle_court.startsWith("CPH")
}

////////////////////////
// MAPPING FUNCTIONS
////////////////////////

function computeAdditionalTerms(
  pseudoRules: RawCph['metadatas']['recommandationOccultation']
): string {
  return pseudoRules.elementsAOcculter.map((_) => `+${_}`).join('|')
}

export function mapCphDecision(
  cphMetadatas: RawCph['metadatas'],
  content: string,
  occultationStrategy: Required<Pick<CodeNac, 'blocOccultationCA' | 'categoriesToOmitCA'>>,
  filenameSource: string
): UnIdentifiedDecisionCph {
  const recommandationOccultation = cphMetadatas.recommandationOccultation
    .suiviRecommandationOccultation
    ? SuiviOccultation.CONFORME
    : SuiviOccultation.AUCUNE

  return {
    sourceId: cphMetadatas.identifiantDecision,
    sourceName: 'portalis-cph',
    originalText: content,
    labelStatus: LabelStatus.TOBETREATED,
    publishStatus: PublishStatus.TOBEPUBLISHED,
    dateCreation: new Date().toISOString(),
    dateDecision: new Date(
      parseInt(cphMetadatas.decision.date.slice(0, 4)),
      parseInt(cphMetadatas.decision.date.slice(4, 6)) - 1,
      parseInt(cphMetadatas.decision.date.slice(6, 8))
    ).toISOString(),
    NACCode: cphMetadatas.dossier.nature_affaire_civile.code,
    // NACLibelle: metadatas.dossier.nature_affaire_civile.libelle, // TODO: which value ? - low
    endCaseCode: (
      cphMetadatas.decision.codes_decision
        .code_decision[0] as RawCph['metadatas']['decision']['codes_decision']['code_decision'][number]
    ).code, // index[0] is safe due zod schema
    // libelleEndCaseCode: endCaseCode: (
    //   metadatas.decision.codes_decision
    //     .code_decision[0] as CphMetadatas["decision"]["codes_decision"]["code_decision"][number]
    // ).libelle, // TODO: which value ? - low
    jurisdictionCode: cphMetadatas.juridiction.libelle_court,
    jurisdictionId: cphMetadatas.juridiction.code_srj,
    jurisdictionName: cphMetadatas.juridiction.libelle_long,
    selection: cphMetadatas.interetParticulier,
    sommaire: cphMetadatas.sommaireInteretParticulier,
    blocOccultation: occultationStrategy.blocOccultationCA,
    occultation: {
      additionalTerms: computeAdditionalTerms(cphMetadatas.recommandationOccultation),
      categoriesToOmit: occultationStrategy.categoriesToOmitCA[recommandationOccultation],
      motivationOccultation: false
    },
    recommandationOccultation,
    formation: (cphMetadatas.audiences_dossier?.audience_dossier ?? []).find(
      (_) => _.chronologie === 'COURANTE'
    )?.formation,
    parties: [], // TODO: which value ? - low
    composition: [], // TODO: which value ? - low
    tiers: [], // TODO: which value ? - low
    public:
      (cphMetadatas.evenement_porteur.caracteristiques.caracteristique.find((_) => _.mnemo === 'PUBD')
        ?.valeur ?? 'audience publique') === 'audience publique',
    debatPublic:
      (cphMetadatas.evenement_porteur.caracteristiques.caracteristique.find((_) => _.mnemo === 'PUB')
        ?.valeur ?? '') === '', // TODO: which value ? - high
    pourvoiCourDeCassation: false, // TODO: which value ? - high
    pourvoiLocal: false, // TODO: which value ? - high
    filenameSource
  }
}
