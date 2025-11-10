import { disconnect } from '../../library/DbRawFile'
import { runNormalizationLoop } from './normalizationLoop'

runNormalizationLoop().finally(() => {
  setTimeout(disconnect, 3000)
}) // probably useless to wait - just in case
