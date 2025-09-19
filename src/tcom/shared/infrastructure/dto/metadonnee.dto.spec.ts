import { ArgumentMetadata } from '@nestjs/common'
import { QualitePartieExhaustive, TypePartieExhaustive } from 'dbsder-api-types'
import { MockUtils } from '../utils/mock.utils'
import { ValidateDtoPipe } from './validateDto.pipe'
import { BadPropertiesException } from '../exceptions/missingProperties.exception'
import { AdresseDto, CompositionDto, MetadonneeDto, PartieDto } from './metadonnee.dto'

describe('Validate MetadonneeDTO format', () => {
  const target = new ValidateDtoPipe()
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: MetadonneeDto,
    data: ''
  }
  beforeEach(() => {
    jest.resetAllMocks()
  })

  const mockUtils = new MockUtils()
  const someValidMetaDonneeDto = mockUtils.mandatoryMetadonneesDtoMock

  describe('Success case when all mandatory fields are provided', () => {
    it('returns provided object when provided object is a MetadonneeDto with valid mandatory properties', async () => {
      // WHEN
      const response = await target.transform(someValidMetaDonneeDto, metadata)
      // THEN
      expect(response).toEqual(someValidMetaDonneeDto)
    })
  })

  describe('libelleJuridiction property', () => {
    it('throws an error when libelleJuridiction is not a string', async () => {
      // GIVEN
      const invalidLibelleJuridiction = 123
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        libelleJuridiction: invalidLibelleJuridiction
      }
      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })

    it('throws an error when libelleJuridiction has more than 42 characters', async () => {
      // GIVEN
      const invalidLibelleJuridiction = 'Some jurisdiction name which is way too long to fit'
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        libelleJuridiction: invalidLibelleJuridiction
      }
      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })

    it('throws an error when libelleJuridiction has less than 2 characters', async () => {
      // GIVEN
      const invalidLibelleJuridiction = 'S'
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        libelleJuridiction: invalidLibelleJuridiction
      }
      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })
  })

  describe('idJuridiction property', () => {
    it('throws an error when idJuridiction is invalid', async () => {
      // GIVEN
      const invalidIdJuridiction = 'INVALID'
      const invalidMetadonnee = { ...someValidMetaDonneeDto, idJuridiction: invalidIdJuridiction }
      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })

    it('throws an error when idJuridiction is not a string', async () => {
      // GIVEN
      const invalidIdJuridiction = 1234
      const invalidMetadonnee = { ...someValidMetaDonneeDto, idJuridiction: invalidIdJuridiction }
      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })
  })

  describe('dateDecision property', () => {
    it('throws an error when dateDecision is not a string', async () => {
      // GIVEN
      const invalidDateDecision = 123
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        dateDecision: invalidDateDecision
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })

    it('throws an error when dateDecision is more than 8 characters', async () => {
      // GIVEN
      const invalidDateDecision = '2022-11-22T 07:07:07'
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        dateDecision: invalidDateDecision
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })

    it('throws an error when dateDecision is a string but incorrect valid values', async () => {
      // GIVEN
      const invalidDateDecision = '20223333'
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        dateDecision: invalidDateDecision
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })

    it('throws an error when dateDecision is a string but incorrect format', async () => {
      // GIVEN
      const invalidDateDecision = '20102022' // DDMMYYYY instead of YYYYMMDD
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        dateDecision: invalidDateDecision
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })

    it('throws an error when dateDecision is a string but incorrect format', async () => {
      // GIVEN
      const invalidDateDecision = '20223012' // YYYYDDMM instead of YYYYMMDD
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        dateDecision: invalidDateDecision
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })
  })

  describe('validate partieDto (partieDto) format', () => {
    it('succeeds when parties property only has mandatory elements', async () => {
      // GIVEN
      const partiesWithMandatoryFields: PartieDto[] = [mockUtils.mandatoryPartieDtoMock]
      const metadonneesWithParties = {
        ...someValidMetaDonneeDto,
        parties: partiesWithMandatoryFields
      }

      // WHEN
      const response = await target.transform(metadonneesWithParties, metadata)

      // THEN
      expect(response).toEqual(metadonneesWithParties)
    })

    it('succeeds when parties property has all elements', async () => {
      // GIVEN
      const partieWithMandatoryFields: PartieDto[] = [mockUtils.partieDtoMock]
      const metadonneesWithParties = {
        ...someValidMetaDonneeDto,
        parties: partieWithMandatoryFields
      }

      // WHEN
      const response = await target.transform(metadonneesWithParties, metadata)

      // THEN
      expect(response).toEqual(metadonneesWithParties)
    })

    it('throws an error when parties property does not have mandatory function element', async () => {
      // GIVEN
      const partiesWithPrenomAndNomProperties = [{ prenom: 'some valid surname', nom: 'some name' }]
      const metadonneesWithParties = {
        ...someValidMetaDonneeDto,
        parties: partiesWithPrenomAndNomProperties
      }

      // WHEN
      await expect(async () => await target.transform(metadonneesWithParties, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })

    it('throws an error when type property on parties does not have valid value', async () => {
      // GIVEN
      const invalidPartieMock = mockUtils.partieDtoMock
      invalidPartieMock.type = 'A' as TypePartieExhaustive
      const partiesWithMandatoryFields = [invalidPartieMock]

      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        parties: partiesWithMandatoryFields
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })
    it('throws an error when qualite property on parties does not have valid value', async () => {
      // GIVEN
      const invalidPartieMock = mockUtils.partieDtoMock
      invalidPartieMock.qualite = 'A' as QualitePartieExhaustive
      const partiesWithMandatoryFields = [invalidPartieMock]

      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        parties: partiesWithMandatoryFields
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })
    it('throws an error when parties is not an array', async () => {
      // GIVEN
      const invalidParties = 12345
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        parties: invalidParties
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })

    it('throws an error when parties is not an array of partie', async () => {
      // GIVEN
      const invalidParties = [1, 2, 3]
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        parties: invalidParties
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })
  })

  describe('validate compositionDto (compositionDto) format', () => {
    it('succeeds when composition property only has mandatory elements', async () => {
      // GIVEN
      const compositionWithMandatoryFields: CompositionDto[] = [
        {
          nom: 'some valid name'
        }
      ]
      const metadonneesWithComposition = {
        ...someValidMetaDonneeDto,
        composition: compositionWithMandatoryFields
      }

      // WHEN
      const response = await target.transform(metadonneesWithComposition, metadata)

      // THEN
      expect(response).toEqual(metadonneesWithComposition)
    })

    it('succeeds when composition property has all elements', async () => {
      // GIVEN
      const compositionWithMandatoryFields: CompositionDto[] = [mockUtils.compositionDtoMock]
      const metadonneesWithComposition = {
        ...someValidMetaDonneeDto,
        composition: compositionWithMandatoryFields
      }

      // WHEN
      const response = await target.transform(metadonneesWithComposition, metadata)

      // THEN
      expect(response).toEqual(metadonneesWithComposition)
    })

    it('throws an error when composition property does not have mandatory function element', async () => {
      // GIVEN
      const compositionWithPrenomAndFonctionProperties = [
        {
          prenom: 'some valid surname',
          fonction: 'some valid fontion'
        }
      ]
      const metadonneesWithComposition = {
        ...someValidMetaDonneeDto,
        parties: compositionWithPrenomAndFonctionProperties
      }

      // WHEN
      await expect(async () => await target.transform(metadonneesWithComposition, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })

    it('throws an error when nom property on parties does not have valid value', async () => {
      // GIVEN
      const compositionWithMandatoryFields = [
        {
          nom: 12345
        }
      ]

      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        parties: compositionWithMandatoryFields
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })
    it('throws an error when composition is not an array', async () => {
      // GIVEN
      const invalidComposition = 12345
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        parties: invalidComposition
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })

    it('throws an error when composition is not an array of partie', async () => {
      // GIVEN
      const invalidComposition = [1, 2, 3]
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        parties: invalidComposition
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })
  })

  describe('decisionPublique property', () => {
    it('throws an error when decisionPublique is not a boolean', async () => {
      // GIVEN
      const invalidDecisionPublique = 12345
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        decisionPublique: invalidDecisionPublique
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })
  })

  describe('occultationsComplementaires property', () => {
    it('throws an error when occultationsComplementaires is not an object', async () => {
      // GIVEN
      const invalidOccultationsComplementaires = 12345
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        occultationsComplementaires: invalidOccultationsComplementaires
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })
  })

  describe('occultationsComplementaires property', () => {
    it('throws an error when occultationsComplementaires is not an object', async () => {
      // GIVEN
      const invalidOccultationsComplementaires = 12345
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        occultationsComplementaires: invalidOccultationsComplementaires
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })
  })

  describe('validate adresseDto (adresseDto) format', () => {
    it('throws an error when adresse is not an object', async () => {
      // GIVEN
      const invalidAdresse = 12345
      const invalidPartieDto = mockUtils.partieDtoMock
      invalidPartieDto.adresse = invalidAdresse as AdresseDto
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        parties: [invalidPartieDto]
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })
    it('succeeds when adresse property has all elements', async () => {
      // GIVEN
      const metadonneesWithParties = {
        ...mockUtils.mandatoryMetadonneesDtoMock
      }

      // WHEN
      const response = await target.transform(metadonneesWithParties, metadata)

      // THEN
      expect(response).toEqual(metadonneesWithParties)
    })
  })

  describe('idDecision property', () => {
    it('throws an error when idDecision is not a string', async () => {
      // GIVEN
      const invalidIdDecision = 2345
      const invalidMetadonnee = {
        ...someValidMetaDonneeDto,
        idDecision: invalidIdDecision
      }

      // WHEN
      await expect(async () => await target.transform(invalidMetadonnee, metadata))
        // THEN
        .rejects.toThrow(BadPropertiesException)
    })
  })
})
