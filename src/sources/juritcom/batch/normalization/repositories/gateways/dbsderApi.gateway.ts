import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common'
import axios from 'axios'
import { DecisionTcom, UnIdentifiedDecisionTcom } from 'dbsder-api-types'
import { logger, TechLog } from '../../../../../../config/logger'

export class DbSderApiGateway {
  async patchDecision(id: string, decisionToSave: UnIdentifiedDecisionTcom) {
    const urlToCall = process.env.DBSDER_API_URL + `/decisions/${id}`

    const result = await axios
      .patch(urlToCall, decisionToSave, {
        headers: {
          'x-api-key': process.env.DBSDER_API_KEY
        }
      })
      .catch((error) => {
        const formatLogs: TechLog = {
          operations: ['normalization', 'patchDecision'],
          path: 'src/sources/juritcom/batch/normalization/repositories/gateways/dbsderApi.gateway.ts',
          message: 'Error while calling DbSder API'
        }
        if (error.response) {
          if (error.response.data.statusCode === HttpStatus.BAD_REQUEST) {
            logger.error({
              ...formatLogs,
              message: JSON.stringify({
                error: error.response.data.message,
                data: error.response.data,
                statusCode: HttpStatus.BAD_REQUEST
              })
            })
            throw new BadRequestException(
              'DbSderAPI Bad request error : ' + error.response.data.message
            )
          } else if (error.response.data.statusCode === HttpStatus.UNAUTHORIZED) {
            logger.error({
              ...formatLogs,
              message: JSON.stringify({
                error: error.response.data.message,
                data: error.response.data,
                statusCode: HttpStatus.UNAUTHORIZED
              })
            })

            throw new UnauthorizedException('You are not authorized to call this route')
          } else if (error.response.data.statusCode === HttpStatus.CONFLICT) {
            logger.error({
              ...formatLogs,
              message: JSON.stringify({
                error: error.response.data.message,
                data: error.response.data,
                statusCode: HttpStatus.CONFLICT
              })
            })
            throw new ConflictException('DbSderAPI error: ' + error.response.data.message)
          } else {
            logger.error({
              ...formatLogs,
              message: JSON.stringify({
                error: error.response.data.message,
                data: error.response.data,
                statusCode: HttpStatus.SERVICE_UNAVAILABLE
              })
            })
          }
        }
        throw new ServiceUnavailableException('DbSder API is unavailable')
      })

    return result.data
  }

  async getDecisionBySourceId(sourceId: number) {
    type Response = {
      decisions: DecisionTcom[]
      totalDecisions: number
      nextPage?: string
      previousPage?: string
    }

    const urlToCall = process.env.DBSDER_API_URL + '/decisions'

    const result = await axios
      .get<Response>(urlToCall, {
        params: { sourceName: 'juritcom', sourceId: `${sourceId}` },
        headers: {
          'x-api-key': process.env.DBSDER_API_KEY
        }
      })
      .catch((error) => {
        const formatLogs: TechLog = {
          operations: ['normalization', 'getDecisionBySourceId'],
          path: 'src/sources/juritcom/batch/normalization/repositories/gateways/dbsderApi.gateway.ts',
          message: 'Error while calling DbSder API'
        }
        if (error.response) {
          if (error.response.data.statusCode === HttpStatus.BAD_REQUEST) {
            logger.error({
              ...formatLogs,
              message: JSON.stringify({
                error: error.response.data.message,
                data: {
                  ...error.response.data,
                  sourceId: sourceId
                },
                statusCode: HttpStatus.BAD_REQUEST
              })
            })
            throw new BadRequestException(
              'DbSderAPI Bad request error : ' + error.response.data.message
            )
          } else if (error.response.data.statusCode === HttpStatus.UNAUTHORIZED) {
            logger.error({
              ...formatLogs,
              message: JSON.stringify({
                error: error.response.data.message,
                data: {
                  ...error.response.data,
                  sourceId: sourceId
                },
                statusCode: HttpStatus.UNAUTHORIZED
              })
            })

            throw new UnauthorizedException('You are not authorized to call this route')
          } else if (error.response.data.statusCode === HttpStatus.CONFLICT) {
            logger.error({
              ...formatLogs,
              message: JSON.stringify({
                error: error.response.data.message,
                data: {
                  ...error.response.data,
                  sourceId: sourceId
                },
                statusCode: HttpStatus.CONFLICT
              })
            })
            throw new ConflictException('DbSderAPI error: ' + error.response.data.message)
          } else {
            logger.error({
              ...formatLogs,
              message: JSON.stringify({
                error: error.response.data.message,
                data: {
                  ...error.response.data,
                  sourceId: sourceId
                },
                statusCode: HttpStatus.SERVICE_UNAVAILABLE
              })
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
}
