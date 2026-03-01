import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common'
import axios from 'axios'
import { DbSderApiGateway } from './dbsderApi.gateway'
import { MockUtils } from '@tj/shared/infrastructure/utils/mock.utils'

jest.mock('@connectors/logger', () => ({
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

jest.mock('axios')

describe('DbSderApi Gateway', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>
  const mockUtils = new MockUtils()
  const gateway = new DbSderApiGateway()

  beforeEach(() => {
    jest.resetAllMocks()
  })

  describe('saveDecision', () => {
    it('returns the saved decision when dbSder API is called with valid parameters', async () => {
      // GIVEN
      const decisionToSave = mockUtils.decisionTJMock
      mockedAxios.put.mockResolvedValueOnce({ data: mockUtils.decisionTJMock })

      // WHEN
      const result = await gateway.saveDecision(decisionToSave)

      // THEN
      expect(result).toEqual(decisionToSave)
    })

    it('throws a 400 Bad Request error when dbSder API is called with missing parameters', async () => {
      // GIVEN
      const incorrectDecisionToSave = mockUtils.decisionTJMock
      delete incorrectDecisionToSave.sourceId

      mockedAxios.put.mockRejectedValueOnce({
        response: {
          data: {
            statusCode: HttpStatus.BAD_REQUEST,
            message: ''
          }
        }
      })

      // WHEN
      expect(async () => await gateway.saveDecision(incorrectDecisionToSave))
        // THEN
        .rejects.toThrow(BadRequestException)
    })

    it('throws a 401 Unauthorized error when normalization is not allowed to call dbSder API', async () => {
      // GIVEN
      const decisionToSave = mockUtils.decisionTJMock
      mockedAxios.put.mockRejectedValueOnce({
        response: {
          data: {
            statusCode: HttpStatus.UNAUTHORIZED,
            message: ''
          }
        }
      })

      // WHEN
      expect(async () => await gateway.saveDecision(decisionToSave))
        // THEN
        .rejects.toThrow(UnauthorizedException)
    })

    it('throws a 409 Conflict error when decision ID already exist in dbSder API', async () => {
      // GIVEN
      const decisionToSave = mockUtils.decisionTJMock
      mockedAxios.put.mockRejectedValueOnce({
        response: {
          data: {
            statusCode: HttpStatus.CONFLICT,
            message: ''
          }
        }
      })

      // WHEN
      expect(async () => await gateway.saveDecision(decisionToSave))
        // THEN
        .rejects.toThrow(ConflictException)
    })

    it('throws a 503 Unavailable error when dbSder API is unavailable', async () => {
      // GIVEN
      const decisionToSave = mockUtils.decisionTJMock
      mockedAxios.put.mockRejectedValueOnce({
        response: {
          data: {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message: ''
          }
        }
      })

      // WHEN
      expect(async () => await gateway.saveDecision(decisionToSave))
        // THEN
        .rejects.toThrow(ServiceUnavailableException)
    })
  })

  describe('patchDecision', () => {
    const decisionId = '507f1f77bcf86cd799439011'
    const decisionToPatch = mockUtils.decisionTJMock

    it('returns the patched decision when dbSder Api is called with valid parameters', async () => {
      // GIVEN
      mockedAxios.patch.mockResolvedValueOnce({ data: mockUtils.decisionTJMock })

      // WHEN
      const result = await gateway.patchDecision(decisionId, decisionToPatch)

      // THEN
      expect(result).toEqual(decisionToPatch)
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        expect.stringContaining(`/decisions/${decisionId}`),
        decisionToPatch,
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': expect.any(String)
          })
        })
      )
    })

    it('throws a 400 Bad Request error when dbSder API is called with invalid parameters', async () => {
      // GIVEN
      mockedAxios.patch.mockRejectedValueOnce({
        response: {
          data: {
            statusCode: HttpStatus.BAD_REQUEST,
            message: ''
          }
        }
      })

      // WHEN
      expect(async () => await gateway.patchDecision(decisionId, decisionToPatch))
        // THEN
        .rejects.toThrow(BadRequestException)
    })

    it('throws a 401 Unauthorized error when normalization is not allowed to call dbSder API', async () => {
      // GIVEN
      mockedAxios.patch.mockRejectedValueOnce({
        response: {
          data: {
            statusCode: HttpStatus.UNAUTHORIZED,
            message: ''
          }
        }
      })

      // WHEN
      expect(async () => await gateway.patchDecision(decisionId, decisionToPatch))
        // THEN
        .rejects.toThrow(UnauthorizedException)
    })

    it('throws a 409 Conflict error when dbSder API detects a conflict', async () => {
      // GIVEN
      mockedAxios.patch.mockRejectedValueOnce({
        response: {
          data: {
            statusCode: HttpStatus.CONFLICT,
            message: ''
          }
        }
      })

      // WHEN
      expect(async () => await gateway.patchDecision(decisionId, decisionToPatch))
        // THEN
        .rejects.toThrow(ConflictException)
    })

    it('throws a 503 Unavailable error when dbSder API is unavailable', async () => {
      // GIVEN
      mockedAxios.patch.mockRejectedValueOnce({
        response: {
          data: {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message: ''
          }
        }
      })

      // WHEN
      expect(async () => await gateway.patchDecision(decisionId, decisionToPatch))
        // THEN
        .rejects.toThrow(ServiceUnavailableException)
    })
  })
})
