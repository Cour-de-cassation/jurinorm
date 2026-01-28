import { disconnect } from '../../connectors/DbRawFile'
import { normalizeRawCaFiles } from '../handler'

normalizeRawCaFiles().finally(() => {
  setTimeout(disconnect, 3000)
}) // probably useless to wait - just in case
