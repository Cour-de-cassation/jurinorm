import { UnIdentifiedDecisionTcom, Category } from 'dbsder-api-types'
import { computeOccultation } from './computeOccultation'
import { MockUtils } from '../../../shared/infrastructure/utils/mock.utils'
import { MetadonneeDto } from '../../../shared/infrastructure/dto/metadonnee.dto'

jest.mock('../index', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    log: jest.fn()
  }
}))

describe('compute occultation', () => {
  it('returns an empty additionalTerms when recommandations are respected', () => {
    // GIVEN
    const metadonnees = new MockUtils().metadonneeDtoMock as unknown as MetadonneeDto
    const expectedResponse: UnIdentifiedDecisionTcom['occultation'] = {
      additionalTerms: '',
      categoriesToOmit: [Category.PROFESSIONNELMAGISTRATGREFFIER],
      motivationOccultation: false
    }

    metadonnees.decisionPublique = true
    metadonnees.occultationsComplementaires = {
      dateCivile: true,
      motifsSecretAffaires: false,
      cadastre: true,
      adresse: true,
      professionnelMagistratGreffier: false,
      plaqueImmatriculation: true,
      coordonneeElectronique: true,
      motifsDebatsChambreConseil: false,
      personneMorale: true,
      conserverElement: '',
      chaineNumeroIdentifiante: true,
      personnePhysicoMoraleGeoMorale: true,
      supprimerElement: ''
    }

    // WHEN
    const response = computeOccultation(metadonnees)

    // THEN
    expect(response).toEqual(expectedResponse)
  })

  it('returns an additionalTerms equal to the provided "occultations complementaires"', () => {
    // GIVEN
    const metadonnees = new MockUtils().metadonneeDtoMock as unknown as MetadonneeDto
    const expectedResponse: UnIdentifiedDecisionTcom['occultation'] = {
      additionalTerms: '+fiat rouge|volvo verte',
      categoriesToOmit: [],
      motivationOccultation: false
    }

    metadonnees.decisionPublique = true
    metadonnees.occultationsComplementaires = {
      dateCivile: true,
      motifsSecretAffaires: false,
      cadastre: true,
      adresse: true,
      professionnelMagistratGreffier: true,
      plaqueImmatriculation: true,
      coordonneeElectronique: true,
      motifsDebatsChambreConseil: false,
      personneMorale: true,
      conserverElement: 'fiat rouge',
      chaineNumeroIdentifiante: true,
      personnePhysicoMoraleGeoMorale: true,
      supprimerElement: 'volvo verte'
    }

    // WHEN
    const response = computeOccultation(metadonnees)

    // THEN
    expect(response).toEqual(expectedResponse)
  })

  it('returns motivationOccultation true when debat are not public', () => {
    // GIVEN
    const metadonnees = new MockUtils().metadonneeDtoMock as unknown as MetadonneeDto
    const expectedResponse: UnIdentifiedDecisionTcom['occultation'] = {
      additionalTerms: '',
      categoriesToOmit: [Category.PROFESSIONNELMAGISTRATGREFFIER],
      motivationOccultation: true
    }

    metadonnees.decisionPublique = true
    metadonnees.occultationsComplementaires = {
      dateCivile: true,
      motifsSecretAffaires: false,
      cadastre: true,
      adresse: true,
      professionnelMagistratGreffier: false,
      plaqueImmatriculation: true,
      coordonneeElectronique: true,
      motifsDebatsChambreConseil: true,
      personneMorale: true,
      conserverElement: '',
      chaineNumeroIdentifiante: true,
      personnePhysicoMoraleGeoMorale: true,
      supprimerElement: ''
    }

    // WHEN
    const response = computeOccultation(metadonnees)

    // THEN
    expect(response).toEqual(expectedResponse)
  })
})
