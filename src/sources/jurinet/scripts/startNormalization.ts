import { disconnect } from '../../../connectors/dbRawFile'
import { normalizeRawCcFiles } from '../handler'

normalizeRawCcFiles().finally(() => {
  setTimeout(disconnect, 3000)
}) // probably useless to wait - just in case
