import { RaisonInteretParticulier } from 'dbsder-api-types'
import { logger } from '../../config/logger'

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

const CODE_REGEX = /^\s*(F\s*[1-3]|S\s*[1-6])\b/i
const CODE_RESERVED_COUR_CASSATION = 'C0'
export function extractCodeFromSommaire(sommaire: string | undefined): string | null {
  const match = sommaire?.match(CODE_REGEX)
  if (!match) {
    return null
  }

  const code = match[1].replace(/\s+/g, '')
  if (code.toUpperCase() === CODE_RESERVED_COUR_CASSATION) {
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

function getRaisonInteretParticulierByCode(code: string): RaisonInteretParticulier | null {
  const raison = CODE_TO_RAISON[code.toUpperCase()]

  if (!raison) {
    logger.warn({
      path: 'src/services/rules/raisonInteretParticulier.ts',
      operations: ['normalization', 'getRaisonInteretParticulierByCode'],
      message: `Invalid RaisonInteretParticulier code: "${code}".`
    })
  }

  return raison ?? null
}
