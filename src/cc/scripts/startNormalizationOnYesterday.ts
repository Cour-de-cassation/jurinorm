import { disconnect } from '../../library/DbRawFile'
import { normalizeRawCcFiles } from '../handler'

normalizeRawCcFiles({
  'events.0.date': { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  events: { $not: { $elemMatch: { type: { $in: ['normalized', 'deleted'] } } } }
}).finally(() => {
  setTimeout(disconnect, 3000)
}) // probably useless to wait - just in case
