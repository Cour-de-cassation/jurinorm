import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common'
import axios from 'axios'
import { logger } from '../../../../shared/infrastructure/utils/log'
import { CodeNac, DecisionTj, UnIdentifiedDecisionTj } from 'dbsder-api-types'

export class DbSderApiGateway {
  async saveDecision(decisionToSave: UnIdentifiedDecisionTj) {
    const urlToCall = process.env.DBSDER_API_URL + '/decisions'

    const result = await axios
      .put(
        urlToCall,
        { decision: decisionToSave },
        {
          headers: {
            'x-api-key': process.env.DBSDER_API_KEY
          }
        }
      )
      .catch((error) => {
        if (error.response) {
          if (error.response.data.statusCode === HttpStatus.BAD_REQUEST) {
            logger.error({
              path: 'src/tj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
              operations: ['normalization', 'saveDecision-TJ'],
              message: error.response.data.message,
              stack: error.stack
            })
            throw new BadRequestException(
              'DbSderAPI Bad request error : ' + error.response.data.message
            )
          } else if (error.response.data.statusCode === HttpStatus.UNAUTHORIZED) {
            logger.error({
              path: 'src/tj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
              operations: ['normalization', 'saveDecision-TJ'],
              message: error.response.data.message,
              stack: error.stack
            })

            throw new UnauthorizedException('You are not authorized to call this route')
          } else if (error.response.data.statusCode === HttpStatus.CONFLICT) {
            logger.error({
              path: 'src/tj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
              operations: ['normalization', 'saveDecision-TJ'],
              message: error.response.data.message,
              stack: error.stack
            })
            throw new ConflictException('DbSderAPI error: ' + error.response.data.message)
          } else {
            logger.error({
              path: 'src/tj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
              operations: ['normalization', 'saveDecision-TJ'],
              message: error.response.data.message,
              stack: error.stack
            })
          }
        }
        throw new ServiceUnavailableException('DbSder API is unavailable')
      })

    return result.data
  }

  async getDecisionBySourceId(sourceId: number) {
    type Response = {
      decisions: (Omit<DecisionTj, '_id'> & { _id: string })[]
      totalDecisions: number
      nextPage?: string
      previousPage?: string
    }

    const urlToCall = process.env.DBSDER_API_URL + '/decisions'

    const result = await axios
      .get<Response>(urlToCall, {
        params: { sourceName: 'juritj', sourceId: `${sourceId}` },
        headers: {
          'x-api-key': process.env.DBSDER_API_KEY
        }
      })
      .catch((error) => {
        if (error.response) {
          if (error.response.data.statusCode === HttpStatus.BAD_REQUEST) {
            logger.error({
              path: 'src/tj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
              operations: ['normalization', 'getDecisionBySourceId-TJ'],
              message: error.response.data.message,
              stack: error.stack
            })
            throw new BadRequestException(
              'DbSderAPI Bad request error : ' + error.response.data.message
            )
          } else if (error.response.data.statusCode === HttpStatus.UNAUTHORIZED) {
            logger.error({
              path: 'src/tj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
              operations: ['normalization', 'getDecisionBySourceId-TJ'],
              message: error.response.data.message,
              stack: error.stack
            })

            throw new UnauthorizedException('You are not authorized to call this route')
          } else if (error.response.data.statusCode === HttpStatus.CONFLICT) {
            logger.error({
              path: 'src/tj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
              operations: ['normalization', 'getDecisionBySourceId-TJ'],
              message: error.response.data.message,
              stack: error.stack
            })
            throw new ConflictException('DbSderAPI error: ' + error.response.data.message)
          } else {
            logger.error({
              path: 'src/tj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
              operations: ['normalization', 'getDecisionBySourceId-TJ'],
              message: error.response.data.message,
              stack: error.stack
            })
          }
        }
        throw new ServiceUnavailableException('DbSder API is unavailable')
      })

    if (result && Array.isArray(result.data.decisions) && result.data.decisions.length > 0) {
      return result.data.decisions[0]
    } else {
      return null
    }
  }

  async patchDecision(id: string, decisionToSave: UnIdentifiedDecisionTj) {
    const urlToCall = process.env.DBSDER_API_URL + `/decisions/${id}`

    const result = await axios
      .patch(urlToCall, decisionToSave, {
        headers: {
          'x-api-key': process.env.DBSDER_API_KEY
        }
      })
      .catch((error) => {
        if (error.response) {
          if (error.response.data.statusCode === HttpStatus.BAD_REQUEST) {
            logger.error({
              path: 'src/tj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
              operations: ['normalization', 'patchDecision-TJ'],
              message: error.response.data.message,
              stack: error.stack
            })
            throw new BadRequestException(
              'DbSderAPI Bad request error : ' + error.response.data.message
            )
          } else if (error.response.data.statusCode === HttpStatus.UNAUTHORIZED) {
            logger.error({
              path: 'src/tj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
              operations: ['normalization', 'patchDecision-TJ'],
              message: error.response.data.message,
              stack: error.stack
            })

            throw new UnauthorizedException('You are not authorized to call this route')
          } else if (error.response.data.statusCode === HttpStatus.CONFLICT) {
            logger.error({
              path: 'src/tj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
              operations: ['normalization', 'patchDecision-TJ'],
              message: error.response.data.message,
              stack: error.stack
            })
            throw new ConflictException('DbSderAPI error: ' + error.response.data.message)
          } else {
            logger.error({
              path: 'src/tj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
              operations: ['normalization', 'patchDecision-TJ'],
              message: error.response.data.message,
              stack: error.stack
            })
          }
        }
        throw new ServiceUnavailableException('DbSder API is unavailable')
      })

    return result.data
  }

  async getCodeNac(codeNAC: string) {
    type Response = CodeNac | undefined

    const urlToCall = `${process.env.DBSDER_API_URL}/codenacs/${codeNAC}`

    const result = await axios
      .get<Response>(urlToCall, {
        headers: {
          'x-api-key': process.env.DBSDER_API_KEY
        }
      })
      .catch((error) => {
        if (error.response) {
          if (error.response.status === HttpStatus.NOT_FOUND) {
            return undefined
          }
          if (error.response.data.statusCode === HttpStatus.BAD_REQUEST) {
            logger.error({
              path: 'src/tj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
              operations: ['normalization', 'getCodeNac-TJ'],
              message: error.response.data.message,
              stack: error.stack
            })
            throw new BadRequestException(
              'DbSderAPI Bad request error : ' + error.response.data.message
            )
          } else if (error.response.data.statusCode === HttpStatus.UNAUTHORIZED) {
            logger.error({
              path: 'src/tj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
              operations: ['normalization', 'getCodeNac-TJ'],
              message: error.response.data.message,
              stack: error.stack
            })

            throw new UnauthorizedException('You are not authorized to call this route')
          } else if (error.response.data.statusCode === HttpStatus.CONFLICT) {
            logger.error({
              path: 'src/tj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
              operations: ['normalization', 'getCodeNac-TJ'],
              message: error.response.data.message,
              stack: error.stack
            })
            throw new ConflictException('DbSderAPI error: ' + error.response.data.message)
          } else {
            logger.error({
              path: 'src/tj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
              operations: ['normalization', 'getCodeNac-TJ'],
              message: error.response.data.message,
              stack: error.stack
            })
          }
        }
        throw new ServiceUnavailableException('DbSder API is unavailable')
      })

    if (result) {
      return result.data
    } else {
      return null
    }
  }
}
