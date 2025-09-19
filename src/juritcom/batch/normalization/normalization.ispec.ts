import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import 'aws-sdk-client-mock-jest'
import { AwsClientStub, mockClient } from 'aws-sdk-client-mock'
import { normalizationJob } from './normalization'
import { MockUtils } from '../../shared/infrastructure/utils/mock.utils'
import { Readable } from 'stream'
import { sdkStreamMixin } from '@smithy/util-stream'
import { DbSderApiGateway } from './repositories/gateways/dbsderApi.gateway'
import { InfrastructureException } from '../../shared/infrastructure/exceptions/infrastructure.exception'
import { CollectDto } from '../../shared/infrastructure/dto/collect.dto'
// import { ConvertedDecisionWithMetadonneesDto } from '../../shared/infrastructure/dto/convertedDecisionWithMetadonnees.dto'

jest.mock('./index', () => ({
  logger: {
    log: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  },
  normalizationFormatLogs: {
    operationName: 'normalizationJob',
    msg: 'Starting normalization job...'
  }
}))

describe('Normalization', () => {
  const mockS3: AwsClientStub<S3Client> = mockClient(S3Client)

  const mockUtils = new MockUtils()
  const decisionIntegre = mockUtils.decisionContentToNormalize
  const metadonneesFromS3 = mockUtils.metadonneeDtoMock
  // const normalizedMetadonnees = mockUtils.decisionMock

  beforeEach(() => {
    mockS3.reset()
    jest.resetAllMocks()

    mockS3.on(PutObjectCommand).resolves({})
    mockS3.on(DeleteObjectCommand).resolves({})
  })

  beforeAll(() => {
    jest.useFakeTimers()
    jest.setSystemTime(mockUtils.dateNow)
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  describe('Success Cases', () => {
    it('returns an empty list when no decisions are present', async () => {
      // GIVEN
      const emptyListFromS3 = {
        Contents: []
      }
      mockS3.on(ListObjectsV2Command).resolves(emptyListFromS3)

      const expected = []

      // WHEN
      const response = await normalizationJob()

      // THEN
      expect(response).toEqual(expected)
    })

    /*
    it('returns a list of normalized decisions when decisions are present', async () => {
      // GIVEN
      const fileName = 'filename.json'

      const listWithOneElementFromS3 = {
        Contents: [{ Key: fileName }]
      }
      mockS3.on(ListObjectsV2Command).resolves(listWithOneElementFromS3)

      mockS3.on(GetObjectCommand).resolves({
        Body: createFakeDocument(decisionIntegre, metadonneesFromS3)
      })

      jest.spyOn(DbSderApiGateway.prototype, 'saveDecision').mockResolvedValue({})

      const expected: ConvertedDecisionWithMetadonneesDto[] = [
        {
          decisionNormalisee: mockUtils.decisionContentNormalized,
          metadonnees: {
            ...normalizedMetadonnees,
            labelStatus: LabelStatus.TOBETREATED,
            filenameSource: fileName
          }
        }
      ]

      // WHEN
      const result = await normalizationJob()

      // THEN
      expect(result).toEqual(expected)
    })

    it('returns 3 normalized decisions when 3 decisions are available on S3 (restarts until all decisions from S3 are treated)', async () => {
      // GIVEN
      const firstFilename = 'firstFilename.json'
      const secondFilename = 'secondFilename.json'
      const thirdFilename = 'thirdFilename.json'

      // S3 must be called 3 times to return 2 + 1 decision filename
      const listWithTwoElementsFromS3 = {
        Contents: [{ Key: firstFilename }, { Key: secondFilename }]
      }
      const listWithOneElementFromS3 = {
        Contents: [{ Key: thirdFilename }]
      }
      mockS3
        .on(ListObjectsV2Command)
        .resolvesOnce(listWithTwoElementsFromS3)
        .resolvesOnce(listWithOneElementFromS3)
        .resolves({})

      // S3 must be called 3 times to retrieve decisions content
      mockS3
        .on(GetObjectCommand)
        .resolvesOnce({
          Body: createFakeDocument(decisionIntegre, { ...metadonneesFromS3, idDecision: 'first' })
        })
        .resolvesOnce({
          Body: createFakeDocument(decisionIntegre, { ...metadonneesFromS3, idDecision: 'second' })
        })
        .resolvesOnce({
          Body: createFakeDocument(decisionIntegre, { ...metadonneesFromS3, idDecision: 'third' })
        })
        .resolves({})

      jest.spyOn(DbSderApiGateway.prototype, 'saveDecision').mockResolvedValue({})

      const expected = [
        {
          decisionNormalisee: mockUtils.decisionContentNormalized,
          metadonnees: {
            ...normalizedMetadonnees,
            labelStatus: LabelStatus.TOBETREATED,
            filenameSource: firstFilename,
            sourceId: 182325407
          }
        },
        {
          decisionNormalisee: mockUtils.decisionContentNormalized,
          metadonnees: {
            ...normalizedMetadonnees,
            labelStatus: LabelStatus.TOBETREATED,
            filenameSource: secondFilename,
            sourceId: 1126719509
          }
        },
        {
          decisionNormalisee: mockUtils.decisionContentNormalized,
          metadonnees: {
            ...normalizedMetadonnees,
            labelStatus: LabelStatus.TOBETREATED,
            filenameSource: thirdFilename,
            sourceId: 164456582
          }
        }
      ]

      // WHEN
      const result = await normalizationJob()

      // THEN
      expect(mockS3).toHaveReceivedCommandTimes(ListObjectsV2Command, 3)
      expect(result).toEqual(expected)
    })
    */
  })

  describe('Failing Cases', () => {
    it('returns an exception when S3 is unavailable', async () => {
      // GIVEN
      mockS3.on(ListObjectsV2Command).rejects(new Error())

      // WHEN
      expect(async () => await normalizationJob())
        // THEN
        .rejects.toThrow(InfrastructureException)
    })

    it('returns an empty list when S3 is available but dbSder API is unavailable', async () => {
      // GIVEN
      const listWithOneElementFromS3 = {
        Contents: [{ Key: 'filename' }]
      }
      mockS3.on(ListObjectsV2Command).resolves(listWithOneElementFromS3)

      mockS3.on(GetObjectCommand).resolves({
        Body: createFakeDocument(decisionIntegre, metadonneesFromS3)
      })

      jest.spyOn(DbSderApiGateway.prototype, 'saveDecision').mockRejectedValueOnce(new Error())

      // WHEN
      const result = await normalizationJob()

      // THEN
      expect(result).toEqual([])
    })
  })
})

function createFakeDocument(
  texteDecisionIntegre: string,
  metadonnees: MockUtils['metadonneeDtoMock']
) {
  const decision: CollectDto = {
    texteDecisionIntegre: texteDecisionIntegre,
    metadonnees,
    date: new Date()
  }
  const stream = new Readable()
  stream.push(JSON.stringify(decision))
  stream.push(null)
  return sdkStreamMixin(stream)
}
