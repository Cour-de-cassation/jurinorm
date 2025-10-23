import { disconnect } from '../../library/DbRawFile'
import { normalizeRawCaFiles } from '../handler'

normalizeRawCaFiles({
  'events.0.date': { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  events: { $not: { $elemMatch: { type: 'normalized' } } }
}).finally(() => {
  setTimeout(disconnect, 3000)
}) // probably useless to wait - just in case
