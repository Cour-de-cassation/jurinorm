import zod from 'zod'
import {
  CategoriesToOmit,
  CodeNac,
  LabelStatus,
  PublishStatus,
  SuiviOccultation,
  UnIdentifiedDecisionCph
} from 'dbsder-api-types'
import { RawFile } from '../../services/eventSourcing'
import { Zoning } from 'dbsder-api-types/dist/typeGuards/common.zod'

export type FilePortalis = {
  mimetype: string
  size: number
  buffer: Buffer
}

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

const schemaPortalisMetadatas = zod.object({
  identifiantDecision: zod.string().trim().min(1),
  recommandationOccultation: zod.object({
    suiviRecommandationOccultation: zod.boolean(),
    elementsAOcculter: zod.array(zod.string())
  }),
  interetParticulier: zod.boolean(),
  sommaireInteretParticulier: zod.string().optional(),
  metadatas: zod.object({
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
      numero: zod.string(),
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
})
export type PortalisMetadatas = zod.infer<typeof schemaPortalisMetadatas>

function computeAdditionalTerms(
  pseudoRules: PortalisMetadatas['recommandationOccultation']
): string {
  return pseudoRules.elementsAOcculter.map((_) => `+${_}`).join('|')
}

export function mapPortalisDecision(
  { metadatas, ...publicationRules }: PortalisMetadatas,
  content: string,
  originalTextZoning: Zoning,
  occultationStrategy: Required<Pick<CodeNac, 'blocOccultation' | 'categoriesToOmit'>>,
  filenameSource: string
): UnIdentifiedDecisionCph {
  const recommandationOccultation = publicationRules.recommandationOccultation
    .suiviRecommandationOccultation
    ? SuiviOccultation.CONFORME
    : SuiviOccultation.AUCUNE

  return {
    sourceId: publicationRules.identifiantDecision,
    sourceName: 'portalis-cph',
    portalisNumber: metadatas.dossier.numero,
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
        .code_decision[0] as PortalisMetadatas['metadatas']['decision']['codes_decision']['code_decision'][number]
    ).code, // index[0] is safe due zod schema
    originalTextZoning: originalTextZoning,
    jurisdictionCode: metadatas.juridiction.libelle_court,
    jurisdictionId: metadatas.juridiction.code_srj,
    jurisdictionName: metadatas.juridiction.libelle_long,
    selection: publicationRules.interetParticulier,
    sommaire: publicationRules.sommaireInteretParticulier,
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

export type RawPortalis = RawFile<PortalisMetadatas>

const utcDateSchema = zod.iso.date().transform((val) => new Date(val))
export const parseStatusQuery = zod.object({
  from_date: utcDateSchema,
  from_id: zod.string().optional()
}).safeParse
