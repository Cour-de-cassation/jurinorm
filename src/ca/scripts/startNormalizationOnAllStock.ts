import { disconnect } from '../../connectors/DbRawFile'
import { normalizeRawCaFiles } from '../handler'

normalizeRawCaFiles({
  events: { $not: { $elemMatch: { type: { $in: ['normalized', 'deleted'] } } } }
}).finally(() => {
  setTimeout(disconnect, 3000)
}) // probably useless to wait - just in case
