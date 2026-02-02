import { RaisonInteretParticulier } from 'dbsder-api-types'
import { logger } from '../../connectors/logger'

export function computeRaisonInteretParticulier(
  selection: boolean | undefined,
  sommaire: string | undefined
): RaisonInteretParticulier | null {
  if (!selection) {
    return null
  }

  const code = extractCodeFromSommaire(sommaire)
  if (!code) {
    return null
  }

  return getRaisonInteretParticulierByCode(code)
}

export function extractCodeFromSommaire(sommaire: string | undefined): string | null {
  const code = sommaire?.trim().split(' ')[0] ?? ''

  return /^[A-Za-z][0-9]$/.test(code) ? code : null
}

const CODE_TO_RAISON: Record<string, RaisonInteretParticulier> = buildRaisonMap()
function buildRaisonMap(): Record<string, RaisonInteretParticulier> {
  const map: Record<string, RaisonInteretParticulier> = {}
  for (const value of Object.values(RaisonInteretParticulier)) {
    const code = value.substring(0, 2).toUpperCase()
    map[code] = value
  }

  return map
}

function getRaisonInteretParticulierByCode(code: string): RaisonInteretParticulier | null {
  const raison = CODE_TO_RAISON[code.toUpperCase()]

  if (!raison) {
    logger.warn({
      path: __filename,
      operations: ['normalization', 'getRaisonInteretParticulierByCode'],
      message: `Invalid RaisonInteretParticulier code: "${code}".`
    })
  }

  return raison ?? null
}
