import { UnIdentifiedDecisionTcom, Category } from 'dbsder-api-types'
import { logger, normalizationFormatLogs } from '../logger'
import { LogsFormat } from '../../../shared/infrastructure/utils/logsFormat.utils'
import {
  OccultationComplementaireDto,
  MetadonneeDto
} from '../../../shared/infrastructure/dto/metadonnee.dto'

const jurisdictionsWithErroneousOccultations = []

function isNonEmptyString(str: string | undefined): str is string {
  return typeof str === 'string' && str.trim() !== ''
}

function occultationsDataAreEmpty(
  occultationsComplementaires: OccultationComplementaireDto
): boolean {
  if (occultationsComplementaires.personneMorale === true) {
    return false
  }
  if (occultationsComplementaires.personnePhysicoMoraleGeoMorale === true) {
    return false
  }
  if (occultationsComplementaires.adresse === true) {
    return false
  }
  if (occultationsComplementaires.dateCivile === true) {
    return false
  }
  if (occultationsComplementaires.plaqueImmatriculation === true) {
    return false
  }
  if (occultationsComplementaires.cadastre === true) {
    return false
  }
  if (occultationsComplementaires.chaineNumeroIdentifiante === true) {
    return false
  }
  if (occultationsComplementaires.coordonneeElectronique === true) {
    return false
  }
  if (occultationsComplementaires.professionnelMagistratGreffier === true) {
    return false
  }
  if (occultationsComplementaires.motifsDebatsChambreConseil === true) {
    return false
  }
  if (occultationsComplementaires.motifsSecretAffaires === true) {
    return false
  }
  if (
    occultationsComplementaires.conserverElement &&
    isNonEmptyString(occultationsComplementaires.conserverElement)
  ) {
    return false
  }
  if (
    occultationsComplementaires.supprimerElement &&
    isNonEmptyString(occultationsComplementaires.supprimerElement)
  ) {
    return false
  }
  return true
}

export function computeOccultation(
  metadonnees: MetadonneeDto
): UnIdentifiedDecisionTcom['occultation'] {
  const occultationsComplementaires: OccultationComplementaireDto =
    metadonnees.occultationsComplementaires

  const formatLogs: LogsFormat = {
    ...normalizationFormatLogs,
    operationName: 'computeOccultation',
    msg: 'Starting computeOccultation...'
  }

  if (
    jurisdictionsWithErroneousOccultations.includes(metadonnees.idJuridiction) &&
    occultationsDataAreEmpty(occultationsComplementaires)
  ) {
    logger.warn({
      ...formatLogs,
      msg: `Empty occultations form received, applying the default "bloc 3" signature`,
      idJuridiction: metadonnees.idJuridiction,
      libelleJuridiction: metadonnees.libelleJuridiction
    })

    return {
      additionalTerms: '',
      categoriesToOmit: [
        Category.PERSONNEMORALE,
        Category.NUMEROSIRETSIREN,
        Category.PROFESSIONNELMAGISTRATGREFFIER
      ],
      motivationOccultation: false
    }
  } else {
    const categoriesToOmitRaw = []
    const additionalTermsRaw = []
    const motivationOccultation =
      occultationsComplementaires.motifsDebatsChambreConseil === true ||
      occultationsComplementaires.motifsSecretAffaires === true

    logger.info({
      ...formatLogs,
      msg: `motivationOccultation computed ${motivationOccultation}`
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
      msg: `categoriesToOmit computed ${categoriesToOmit}`
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
      msg: `additionalTerms computed ${additionalTerms}`
    })

    return {
      additionalTerms,
      categoriesToOmit,
      motivationOccultation
    }
  }
}
