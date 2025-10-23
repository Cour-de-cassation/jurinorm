import { disconnect } from '../../library/DbRawFile'
import { normalizeRawCaFiles } from '../handler'

normalizeRawCaFiles({ events: { $not: { $elemMatch: { type: 'normalized' } } } }).finally(() => {
  setTimeout(disconnect, 3000)
}) // probably useless to wait - just in case
