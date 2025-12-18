import { disconnect } from '../../connectors/DbRawFile'
import { normalizeRawCphFiles } from '../handler'

normalizeRawCphFiles({ events: { $not: { $elemMatch: { type: 'normalized' } } } }).finally(() => {
  setTimeout(disconnect, 3000)
}) // probably useless to wait - just in case
