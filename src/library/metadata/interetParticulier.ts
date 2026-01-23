import { RaisonInteretParticulier } from 'dbsder-api-types';
import { logger } from '../logger';

export function computeInteretParticulier(
  selection: boolean | undefined,
  sommaire: string | undefined
): {
  interetParticulier: boolean;
  raisonInteretParticulier: RaisonInteretParticulier | undefined;
} {
  const trimmedSommaire = sommaire?.trim() ?? '';
  if (!selection || trimmedSommaire.length < 2) {
    return {
      interetParticulier: false,
      raisonInteretParticulier: undefined,
    };
  }

  const code = trimmedSommaire.slice(0, 2);
  const raisonInteretParticulier = getRaisonInteretParticulierByCode(code);

  return {
    interetParticulier: Boolean(raisonInteretParticulier),
    raisonInteretParticulier,
  };
}

const CODE_TO_RAISON: Record<string, RaisonInteretParticulier> = buildRaisonMap();
function buildRaisonMap(): Record<string, RaisonInteretParticulier> {
  const map: Record<string, RaisonInteretParticulier> = {};
  for (const value of Object.values(RaisonInteretParticulier)) {
    const code = value.substring(0, 2).toUpperCase();
    map[code] = value;
  }
  return map;
}

function getRaisonInteretParticulierByCode(code: string): RaisonInteretParticulier | undefined {
  const raison = CODE_TO_RAISON[code.toUpperCase()];

  if (!raison) {
    logger.warn({
      path: __filename,
      operations: ['normalization', 'getRaisonInteretParticulierByCode'],
      message: `Invalid RaisonInteretParticulier code: "${code}".`,
    });
  }

  return raison;
}
