// Warn: logger was in index but index is used

import { PinoLogger } from 'nestjs-pino'
import { LogsFormat } from '../../shared/infrastructure/utils/logsFormat.utils'
import { normalizationPinoConfig } from '../../shared/infrastructure/utils/pinoConfig.utils'

export const logger = new PinoLogger(normalizationPinoConfig)

// WARNING : using normalizationFormatLogs as a global variable to provide correlationId and decisionId in all services
// Replace operationName and msg when using it outside of normalizationJob
// correlationId and decisionId are provided for each normalized decision
export const normalizationFormatLogs: LogsFormat = {
  operationName: 'normalizationJob',
  msg: 'Starting normalization job...'
}
