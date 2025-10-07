import { disconnect } from '../library/DbRawCph'
import { normalizeRawCphFiles } from '../service/handler'

normalizeRawCphFiles().finally(() => {
  setTimeout(disconnect, 3000)
}) // probably useless to wait - just in case
