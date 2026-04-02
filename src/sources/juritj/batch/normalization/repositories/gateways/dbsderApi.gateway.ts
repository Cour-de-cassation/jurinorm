import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common'
import axios from 'axios'
import { logger, TechLog } from '../../../../../../config/logger'
import { CodeNac, DecisionTj, UnIdentifiedDecisionTj } from 'dbsder-api-types'

const formatLogs: TechLog = {
  path: 'src/sources/juritj/batch/normalization/repositories/gateway/dbsderApi.gateway.ts',
  operations: ['normalization', 'saveDecision-TJ']
}

const formatLogsGetDecisionBySourceId: TechLog = {
  ...formatLogs,
  operations: ['normalization', 'getDecisionBySourceId-TJ']
}

const formatLogsPatchDecision: TechLog = {
  ...formatLogs,
  operations: ['normalization', 'patchDecision-TJ']
}

const formatLogsGetCodeNac: TechLog = {
  ...formatLogs,
  operations: ['normalization', 'getCodeNac-TJ']
}

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
              ...formatLogs,
              message: JSON.stringify({
                message: error.response.statusText,
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
              message: error.response.data.message,
              stack: error.stack
            })

            throw new UnauthorizedException('You are not authorized to call this route')
          } else if (error.response.data.statusCode === HttpStatus.CONFLICT) {
            logger.error({
              ...formatLogs,
              message: error.response.data.message,
              stack: error.stack
            })
            throw new ConflictException('DbSderAPI error: ' + error.response.data.message)
          } else {
            logger.error({
              ...formatLogs,
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
              ...formatLogsGetDecisionBySourceId,
              message: error.response.data.message,
              stack: error.stack
            })
            throw new BadRequestException(
              'DbSderAPI Bad request error : ' + error.response.data.message
            )
          } else if (error.response.data.statusCode === HttpStatus.UNAUTHORIZED) {
            logger.error({
              ...formatLogsGetDecisionBySourceId,
              message: error.response.data.message,
              stack: error.stack
            })

            throw new UnauthorizedException('You are not authorized to call this route')
          } else if (error.response.data.statusCode === HttpStatus.CONFLICT) {
            logger.error({
              ...formatLogsGetDecisionBySourceId,
              message: error.response.data.message,
              stack: error.stack
            })
            throw new ConflictException('DbSderAPI error: ' + error.response.data.message)
          } else {
            logger.error({
              ...formatLogsGetDecisionBySourceId,
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
              ...formatLogsPatchDecision,
              message: error.response.data.message,
              stack: error.stack
            })
            throw new BadRequestException(
              'DbSderAPI Bad request error : ' + error.response.data.message
            )
          } else if (error.response.data.statusCode === HttpStatus.UNAUTHORIZED) {
            logger.error({
              ...formatLogsPatchDecision,
              message: error.response.data.message,
              stack: error.stack
            })

            throw new UnauthorizedException('You are not authorized to call this route')
          } else if (error.response.data.statusCode === HttpStatus.CONFLICT) {
            logger.error({
              ...formatLogsPatchDecision,
              message: error.response.data.message,
              stack: error.stack
            })
            throw new ConflictException('DbSderAPI error: ' + error.response.data.message)
          } else {
            logger.error({
              ...formatLogsPatchDecision,
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
              ...formatLogsGetCodeNac,
              message: error.response.data.message,
              stack: error.stack
            })
            throw new BadRequestException(
              'DbSderAPI Bad request error : ' + error.response.data.message
            )
          } else if (error.response.data.statusCode === HttpStatus.UNAUTHORIZED) {
            logger.error({
              ...formatLogsGetCodeNac,
              message: error.response.data.message,
              stack: error.stack
            })

            throw new UnauthorizedException('You are not authorized to call this route')
          } else if (error.response.data.statusCode === HttpStatus.CONFLICT) {
            logger.error({
              ...formatLogsGetCodeNac,
              message: error.response.data.message,
              stack: error.stack
            })
            throw new ConflictException('DbSderAPI error: ' + error.response.data.message)
          } else {
            logger.error({
              ...formatLogsGetCodeNac,
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
