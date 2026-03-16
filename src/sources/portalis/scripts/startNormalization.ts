import { disconnect } from '../../../connectors/dbRawFile'
import { normalizeRawCphFiles } from '../handler'

normalizeRawCphFiles().finally(() => {
  setTimeout(disconnect, 3000)
}) // probably useless to wait - just in case
