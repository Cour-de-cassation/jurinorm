import { disconnect } from '../library/DbRawCph'
import { normalizeRawCphFiles } from '../service/handler'

normalizeRawCphFiles({ events: { $not: { $elemMatch: { type: 'normalized' } } } }).finally(() => {
  setTimeout(disconnect, 3000)
}) // probably useless to wait - just in case
