import zod from 'zod'
import { toNotSupported } from '../services/error'
import {
  UnIdentifiedDecisionCph,
  LabelStatus,
  PublishStatus,
  SuiviOccultation,
  CodeNac
} from 'dbsder-api-types'
import { RawFile } from '../services/eventSourcing'

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
export type PublicationRules = zod.infer<typeof schemaPublicationRules>

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
const pdfMetadata = zod.object({
  root: zod.object({ document: schemaCphMetadatas })
})
export type CphMetadatas = zod.infer<typeof schemaCphMetadatas>
export function parseCphMetadatas(cphMetadatas: any): { root: { document: CphMetadatas } } {
  const result = pdfMetadata.safeParse(cphMetadatas)
  if (result.error) throw toNotSupported('cphMetadatas', cphMetadatas, result.error)
  return result.data
}

function computeAdditionalTerms(
  pseudoRules: PublicationRules['recommandationOccultation']
): string {
  return pseudoRules.elementsAOcculter.map((_) => `+${_}`).join('|')
}

export function mapCphDecision(
  metadatas: CphMetadatas,
  content: string,
  publicationRules: PublicationRules,
  occultationStrategy: Required<Pick<CodeNac, 'blocOccultationCA' | 'categoriesToOmitCA'>>,
  filenameSource: string
): UnIdentifiedDecisionCph {
  const recommandationOccultation = publicationRules.recommandationOccultation
    .suiviRecommandationOccultation
    ? SuiviOccultation.CONFORME
    : SuiviOccultation.AUCUNE

  return {
    sourceId: publicationRules.identifiantDecision,
    sourceName: 'portalis-cph',
    originalText: content,
    labelStatus: LabelStatus.TOBETREATED,
    publishStatus: PublishStatus.TOBEPUBLISHED,
    dateCreation: new Date().toISOString(),
    dateDecision: new Date(
      parseInt(metadatas.decision.date.slice(0, 4)),
      parseInt(metadatas.decision.date.slice(4, 6)) - 1,
      parseInt(metadatas.decision.date.slice(6, 8))
    ).toISOString(),
    NACCode: metadatas.dossier.nature_affaire_civile.code,
    // NACLibelle: metadatas.dossier.nature_affaire_civile.libelle, // TODO: which value ? - low
    endCaseCode: (
      metadatas.decision.codes_decision
        .code_decision[0] as CphMetadatas['decision']['codes_decision']['code_decision'][number]
    ).code, // index[0] is safe due zod schema
    // libelleEndCaseCode: endCaseCode: (
    //   metadatas.decision.codes_decision
    //     .code_decision[0] as CphMetadatas["decision"]["codes_decision"]["code_decision"][number]
    // ).libelle, // TODO: which value ? - low
    jurisdictionCode: metadatas.juridiction.libelle_court,
    jurisdictionId: metadatas.juridiction.code_srj,
    jurisdictionName: metadatas.juridiction.libelle_long,
    selection: publicationRules.interetParticulier,
    sommaire: publicationRules.sommaireInteretParticulier,
    blocOccultation: occultationStrategy.blocOccultationCA,
    occultation: {
      additionalTerms: computeAdditionalTerms(publicationRules.recommandationOccultation),
      categoriesToOmit: occultationStrategy.categoriesToOmitCA[recommandationOccultation],
      motivationOccultation: false
    },
    recommandationOccultation,
    formation: (metadatas.audiences_dossier?.audience_dossier ?? []).find(
      (_) => _.chronologie === 'COURANTE'
    )?.formation,
    parties: [], // TODO: which value ? - low
    composition: [], // TODO: which value ? - low
    tiers: [], // TODO: which value ? - low
    public:
      (metadatas.evenement_porteur.caracteristiques.caracteristique.find((_) => _.mnemo === 'PUBD')
        ?.valeur ?? 'audience publique') === 'audience publique',
    debatPublic:
      (metadatas.evenement_porteur.caracteristiques.caracteristique.find((_) => _.mnemo === 'PUB')
        ?.valeur ?? '') === '', // TODO: which value ? - high
    pourvoiCourDeCassation: false, // TODO: which value ? - high
    pourvoiLocal: false, // TODO: which value ? - high
    filenameSource
  }
}

export type RawCph = RawFile<PublicationRules>

const utcDateSchema = zod.iso.date().transform((val) => new Date(val))
export const parseStatusQuery = zod.object({
  from_date: utcDateSchema,
  from_id: zod.string().optional()
}).safeParse
