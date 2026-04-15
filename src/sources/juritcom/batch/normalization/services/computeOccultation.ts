import { UnIdentifiedDecisionTcom, Category } from 'dbsder-api-types'
import { logger, TechLog } from '../../../../../config/logger'
import {
  OccultationComplementaireDto,
  MetadonneeDto
} from '../../../shared/infrastructure/dto/metadonnee.dto'

export function computeOccultation(
  metadonnees: MetadonneeDto
): UnIdentifiedDecisionTcom['occultation'] {
  const occultationsComplementaires: OccultationComplementaireDto =
    metadonnees.occultationsComplementaires

  const formatLogs: TechLog = {
    operations: ['normalization', 'computeOccultation'],
    path: 'src/sources/juritcom/batch/normalization/services/computeOccultation.ts',
    message: 'Starting computeOccultation...'
  }
  logger.info(formatLogs)

  const categoriesToOmitRaw = []
  const additionalTermsRaw = []
  const motivationOccultation = occultationsComplementaires.motifsDebatsChambreConseil === true

  logger.info({
    ...formatLogs,
    message: `motivationOccultation computed ${motivationOccultation}`
  })

  if (occultationsComplementaires.personneMorale !== true) {
    categoriesToOmitRaw.push(Category.PERSONNEMORALE)
    categoriesToOmitRaw.push(Category.NUMEROSIRETSIREN)
  }

  if (occultationsComplementaires.personnePhysicoMoraleGeoMorale !== true) {
    categoriesToOmitRaw.push(Category.PERSONNEMORALE)
    categoriesToOmitRaw.push(Category.LOCALITE)
    categoriesToOmitRaw.push(Category.NUMEROSIRETSIREN)
  }

  if (occultationsComplementaires.adresse !== true) {
    categoriesToOmitRaw.push(Category.ADRESSE)
    categoriesToOmitRaw.push(Category.LOCALITE)
    categoriesToOmitRaw.push(Category.ETABLISSEMENT)
  }

  if (occultationsComplementaires.dateCivile !== true) {
    categoriesToOmitRaw.push(Category.DATENAISSANCE)
    categoriesToOmitRaw.push(Category.DATEDECES)
    categoriesToOmitRaw.push(Category.DATEMARIAGE)
  }

  if (occultationsComplementaires.plaqueImmatriculation !== true) {
    categoriesToOmitRaw.push(Category.PLAQUEIMMATRICULATION)
  }

  if (occultationsComplementaires.cadastre !== true) {
    categoriesToOmitRaw.push(Category.CADASTRE)
  }

  if (occultationsComplementaires.chaineNumeroIdentifiante !== true) {
    categoriesToOmitRaw.push(Category.INSEE)
    categoriesToOmitRaw.push(Category.NUMEROIDENTIFIANT)
    categoriesToOmitRaw.push(Category.COMPTEBANCAIRE)
    categoriesToOmitRaw.push(Category.PLAQUEIMMATRICULATION)
  }

  if (occultationsComplementaires.coordonneeElectronique !== true) {
    categoriesToOmitRaw.push(Category.SITEWEBSENSIBLE)
    categoriesToOmitRaw.push(Category.TELEPHONEFAX)
  }

  if (occultationsComplementaires.professionnelMagistratGreffier !== true) {
    categoriesToOmitRaw.push(Category.PROFESSIONNELMAGISTRATGREFFIER)
  }

  const categoriesToOmit = categoriesToOmitRaw.filter(
    (value, index, array) => array.indexOf(value) === index
  )

  logger.info({
    ...formatLogs,
    message: `categoriesToOmit computed ${categoriesToOmit}`
  })

  if (occultationsComplementaires.conserverElement) {
    for (let item of `${occultationsComplementaires.conserverElement}`.split('|')) {
      item = item.trim()
      if (item !== '') {
        additionalTermsRaw.push(`+${item}`)
      }
    }
  }

  if (occultationsComplementaires.supprimerElement) {
    for (let item of `${occultationsComplementaires.supprimerElement}`.split('|')) {
      item = item.trim()
      if (item !== '') {
        additionalTermsRaw.push(item)
      }
    }
  }

  const additionalTerms = additionalTermsRaw
    .filter((value, index, array) => array.indexOf(value) === index)
    .join('|')

  logger.info({
    ...formatLogs,
    message: `additionalTerms computed ${additionalTerms}`
  })

  return {
    additionalTerms,
    categoriesToOmit,
    motivationOccultation
  }
}
