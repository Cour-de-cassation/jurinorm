import { RaisonInteretParticulier } from 'dbsder-api-types'
import { logger } from '../logger'

export function computeInteretParticulier(
  selection: boolean | undefined,
  sommaire: string | undefined
): {
  interetParticulier: boolean
  raisonInteretParticulier: RaisonInteretParticulier | undefined
} {
  if (!selection) {
    return {
      interetParticulier: false,
      raisonInteretParticulier: undefined
    }
  }

  const code = extractCodeFromSommaire(sommaire)
  if (!code) {
    return {
      interetParticulier: false,
      raisonInteretParticulier: undefined
    }
  }

  const raisonInteretParticulier = getRaisonInteretParticulierByCode(code)

  return {
    interetParticulier: Boolean(raisonInteretParticulier),
    raisonInteretParticulier
  }
}

export function extractCodeFromSommaire(sommaire: string | undefined): string | null {
  const trimmedSommaire = sommaire?.trim() ?? ''
  if (trimmedSommaire.length < 2) {
    return null
  }

  const code = trimmedSommaire.split(' ')[0]
  if (!/^[A-Za-z][0-9]$/.test(code)) {
    return null
  }

  return code
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

function getRaisonInteretParticulierByCode(code: string): RaisonInteretParticulier | undefined {
  const raison = CODE_TO_RAISON[code.toUpperCase()]

  if (!raison) {
    logger.warn({
      path: __filename,
      operations: ['normalization', 'getRaisonInteretParticulierByCode'],
      message: `Invalid RaisonInteretParticulier code: "${code}".`
    })
  }

  return raison
}
