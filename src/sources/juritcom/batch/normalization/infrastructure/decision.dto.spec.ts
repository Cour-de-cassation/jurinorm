import { mapDecisionNormaliseeToDecisionDto } from './decision.dto'
import { MockUtils } from '../../../shared/infrastructure/utils/mock.utils'

describe('mapDecisionNormaliseeToDecisionDto', () => {
  const mockUtils = new MockUtils()

  beforeAll(() => {
    jest.useFakeTimers()
    jest.setSystemTime(mockUtils.dateNow)
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  it('returns an object mapping decision from S3 to DBSDER API decision type', async () => {
    // GIVEN
    const { uniqueDecisionId, decisionContentNormalized, metadonneeDtoMock, decisionMock } =
      new MockUtils()

    // WHEN
    const mappedDecision = mapDecisionNormaliseeToDecisionDto(
      uniqueDecisionId,
      decisionContentNormalized,
      metadonneeDtoMock,
      'path'
    )
    mappedDecision.dateCreation = new Date(
      parseInt('2024'),
      parseInt('12') - 1,
      parseInt('25')
    ).toISOString()

    // THEN
    expect(mappedDecision).toMatchObject(decisionMock)
  })
})
