import axios from 'axios'
import { logger, TechLog } from '../../../../../config/logger'
import {
  HttpStatus,
  BadRequestException,
  ServiceUnavailableException,
  UnprocessableEntityException
} from '@nestjs/common'
import { UnIdentifiedDecisionTcom } from 'dbsder-api-types'

export class ZoningApiService {


  async getDecisionZoning(
    decision: UnIdentifiedDecisionTcom
  ): Promise<UnIdentifiedDecisionTcom['zoning']> {
    if (process.env.ZONING_DISABLED === 'true') {
      logger.warn({
        operations: ['normalization', 'getDecisionZoning'],
        path: 'src/sources/juritcom/batch/normalization/services/zoningApi.service.ts',
        message: 'Call to zoning API is disabled by env variable. Skiping.'
      })
    } else {
      let zonageSource: string
      switch (decision.sourceName) {
        case 'juritcom':
          zonageSource = 'tcom'
          break
        default:
          throw new BadRequestException(
            `Juritcom cannot handle this sourcename: ${decision.sourceName}`
          )
      }

      const zoningRequestParameters = JSON.stringify({
        arret_id: decision.sourceId,
        source: zonageSource,
        text: decision.originalText
      })
      const zoningApiUrl = process.env.ZONING_API_URL

      const result = await axios({
        data: zoningRequestParameters,
        headers: { 'Content-Type': 'application/json' },
        method: 'post',
        url: `${zoningApiUrl}/zonage`
      }).catch((error) => {
        const formatLogs: TechLog = {
          operations: ['normalization', 'getDecisionZoning'],
          path: 'src/sources/juritcom/batch/normalization/services/zoningApi.service.ts',
          message: 'Error while calling Zoning API'
        }
        if (error.response) {
          if (error.response.status === HttpStatus.BAD_REQUEST) {
            logger.error({
              ...formatLogs,
              message: JSON.stringify({
                message: error.response.statusText,
                data: error.response.data,
                statusCode: HttpStatus.BAD_REQUEST
              })
            })
            throw new BadRequestException(
              `Zoning API Bad request error :  + ${error.response.statusText}`
            )
          } else if (error.response.status === HttpStatus.UNPROCESSABLE_ENTITY) {
            logger.error({
              ...formatLogs,
              message: JSON.stringify({
                message: error.response.statusText,
                data: error.response.data,
                statusCode: HttpStatus.UNPROCESSABLE_ENTITY
              })
            })
            throw new UnprocessableEntityException(
              `Le texte de la décision ${decision.sourceName}:${decision.sourceId} est mal encodé pour l'API de zonage : ${error.response.statusText}`
            )
          } else {
            logger.error({
              ...formatLogs,
              message: JSON.stringify({
                message: error.response.statusText,
                data: error.response.data,
                statusCode: HttpStatus.SERVICE_UNAVAILABLE
              })
            })
          }
        }
        throw new ServiceUnavailableException('Zoning API is unavailable')
      })
      return result.data
    }
  }
}
