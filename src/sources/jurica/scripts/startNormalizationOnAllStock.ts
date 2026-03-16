import { disconnect } from '../../../connectors/dbRawFile'
import { normalizeRawCaFiles } from '../handler'

normalizeRawCaFiles({
  events: { $not: { $elemMatch: { type: { $in: ['normalized', 'deleted'] } } } }
}).finally(() => {
  setTimeout(disconnect, 3000)
}) // probably useless to wait - just in case
