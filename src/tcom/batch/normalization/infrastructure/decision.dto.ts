import { LabelStatus, PublishStatus, UnIdentifiedDecisionTcom } from 'dbsder-api-types'
import { hashDecisionId } from '../../../shared/infrastructure/utils/hash.utils'
import { MetadonneeDto } from '../../../shared/infrastructure/dto/metadonnee.dto'

export function mapDecisionNormaliseeToDecisionDto(
  generatedId: string,
  decisionContent: string,
  metadonnees: MetadonneeDto,
  filename: string
): UnIdentifiedDecisionTcom {
  return {
    __v: 0,
    appeals: [],
    chamberId: metadonnees.idChambre,
    chamberName: metadonnees.libelleChambre,
    dateCreation: new Date().toISOString(),
    dateDecision: parseDate(metadonnees.dateDecision).toISOString(),
    jurisdictionCode: `${metadonnees.idGroupement}_${metadonnees.idJuridiction}`,
    jurisdictionId: metadonnees.idJuridiction,
    jurisdictionName: metadonnees.libelleJuridiction,
    labelStatus: LabelStatus.TOBETREATED,
    publishStatus:
      metadonnees.decisionPublique === true ? PublishStatus.TOBEPUBLISHED : PublishStatus.BLOCKED,
    occultation: {
      additionalTerms: '',
      categoriesToOmit: [],
      motivationOccultation: false
    },
    originalText: decisionContent,
    registerNumber: metadonnees.numeroDossier,
    sourceId: hashDecisionId(generatedId),
    sourceName: 'juritcom',
    blocOccultation: 0,
    filenameSource: filename,
    public: metadonnees.decisionPublique === true,
    solution: metadonnees.libelleProcedure ?? '',
    codeMatiereCivil: metadonnees.idMatiere ?? '',
    parties: metadonnees.parties ?? [],
    idGroupement: metadonnees.idGroupement,
    debatPublic: metadonnees.debatChambreDuConseil === false,
    idDecisionTCOM: generatedId,
    codeProcedure: metadonnees.idProcedure ?? '',
    libelleMatiere: metadonnees.libelleMatiere ?? '',
    selection: metadonnees.interetParticulier === true,
    composition: metadonnees.composition ?? []
  }
}

function parseDate(dateDecision: string) {
  const year = dateDecision.substring(0, 4),
    month = dateDecision.substring(4, 6),
    date = dateDecision.substring(6, 8)

  return new Date(parseInt(year), parseInt(month) - 1, parseInt(date))
}
