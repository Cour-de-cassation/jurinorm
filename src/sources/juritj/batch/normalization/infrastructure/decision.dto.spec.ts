import {
  LabelStatus,
  UnIdentifiedDecisionTj,
  SuiviOccultation,
  RaisonInteretParticulier
} from 'dbsder-api-types'
import { mapDecisionNormaliseeToDecisionDto } from './decision.dto'
import { MockUtils } from '../../../shared/infrastructure/utils/mock.utils'
import { computeRaisonInteretParticulier } from '../../../../../services/rules/raisonInteretParticulier'

jest.mock('../../../../../services/rules/raisonInteretParticulier', () => ({
  computeRaisonInteretParticulier: jest.fn()
}))

describe('mapDecisionNormaliseeToDecisionDto', () => {
  const mockUtils = new MockUtils()
  const generatedId = 'TJ75011A01-1234520240120'
  const decisionContent = mockUtils.decisionContentNormalized

  beforeAll(() => {
    jest.useFakeTimers()
    jest.setSystemTime(mockUtils.dateNow)
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(computeRaisonInteretParticulier as jest.Mock).mockReturnValue(null)
  })

  it('returns an object mapping decision from S3 to DBSDER API decision type', async () => {
    // GIVEN
    const mockDecision = mockUtils.allAttributesMetadonneesDtoMock
    const mockRaw = mockUtils.rawTjMock
    const expectedDecisionDto = mockUtils.decisionTJMock

    // WHEN
    const mappedDecision = mapDecisionNormaliseeToDecisionDto(
      generatedId,
      decisionContent,
      mockDecision,
      mockRaw
    )

    // THEN
    expect(mappedDecision).toMatchObject(expectedDecisionDto)
  })

  it('maps idDecision to idDecisionWinci for both decision and decisionAssociee', async () => {
    // GIVEN
    const mockDecision = {
      ...mockUtils.allAttributesMetadonneesDtoMock,
      idDecision: 'TJ00000',
      decisionAssociee: { ...mockUtils.decisionAssocieeDtoMock, idDecision: 'TJ11111' },
      codeNature: '6C',
      libelleNature: 'Autres demandes en matière de frais et dépens'
    }

    const mockRaw = mockUtils.rawTjMock
    const expectedDecisionDto = {
      ...mockUtils.decisionTJMock,
      decisionAssociee: {
        ...mockUtils.decisionTJMock.decisionAssociee,
        idDecisionWinci: 'TJ11111'
      }
    }

    // WHEN
    const mappedDecision = mapDecisionNormaliseeToDecisionDto(
      generatedId,
      decisionContent,
      mockDecision,
      mockRaw
    )

    // THEN
    expect(mappedDecision).toMatchObject(expectedDecisionDto)
  })

  it('merges metadata with interetParticulier when true', async () => {
    ;(computeRaisonInteretParticulier as jest.Mock).mockReturnValue(
      RaisonInteretParticulier.S4_SUJET_INTERET_PUBLIC_MAJEUR
    )

    const mockRaw = mockUtils.rawTjMock
    const mockDecision = {
      ...mockUtils.mandatoryMetadonneesDtoMock,
      selection: true,
      sommaire: 'S4 - ...'
    }

    const mappedDecision = mapDecisionNormaliseeToDecisionDto(
      generatedId,
      decisionContent,
      mockDecision,
      mockRaw
    )

    expect(mappedDecision).toHaveProperty(
      'raisonInteretParticulier',
      RaisonInteretParticulier.S4_SUJET_INTERET_PUBLIC_MAJEUR
    )
  })
})
