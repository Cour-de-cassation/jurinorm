import { disconnect } from '../../library/DbRaw'
import { normalizeRawCph } from '../service/handler'

normalizeRawCph().finally(() => {
  setTimeout(disconnect, 3000)
}) // probably useless to wait - just in case
