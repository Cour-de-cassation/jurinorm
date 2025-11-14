import { disconnect } from '../../library/DbRawFile'
import { runNormalizationLoop } from './normalizationLoop'

runNormalizationLoop({ events: { $not: { $elemMatch: { type: 'normalized' } } } }).finally(() => {
  setTimeout(disconnect, 3000)
}) // probably useless to wait - just in case
