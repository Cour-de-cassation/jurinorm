import { disconnect } from '../../library/DbRawFile'
import { normalizeRawCcFiles } from '../handler'

normalizeRawCcFiles({ events: { $not: { $elemMatch: { type: 'normalized' } } } }).finally(() => {
  setTimeout(disconnect, 3000)
}) // probably useless to wait - just in case
