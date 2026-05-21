import { CodeNac } from 'dbsder-api-types'
import { S3_BUCKET_NAME_PORTALIS } from '../../config/env'
import { fetchZoning } from '../../connectors/jurizonage'

import { getFileByName } from '../../connectors/bucket'
import { getCodeNac } from '../../connectors/dbSder'

import { NotFound, NotSupported } from '../../services/error'
import { saveDecisionInAffaire } from '../../services/affaire'
import { annotateDecision } from '../../services/rules/annotation'
import { getPdfContent } from '../../services/textExtraction/pdf'

import { mapPortalisDecision, RawPortalis } from './models'

async function getOccultationStrategy(
  code: string
): Promise<Required<Pick<CodeNac, 'blocOccultation' | 'categoriesToOmit'>>> {
  const codeNac = await getCodeNac(code)
  if (!codeNac) throw new NotFound('codeNac', `codeNac ${code} not found`)

  const { blocOccultation, categoriesToOmit } = codeNac
  if (!blocOccultation)
    throw new NotFound(
      'codeNac.blocOccultationCA',
      `codeNac ${code} has no "blocOccultationCA" property`
    )
  if (!categoriesToOmit)
    throw new NotFound(
      'codeNac.categoriesToOmit',
      `codeNac ${code} has no "categoriesToOmit" property`
    )

  return { blocOccultation, categoriesToOmit }
}

export async function normalizePortalis(rawPortalis: RawPortalis): Promise<unknown> {
  const portalisFile = await getFileByName(S3_BUCKET_NAME_PORTALIS, rawPortalis.path)
  const portalisMetadatas = rawPortalis.metadatas

  if (!portalisMetadatas.metadatas.juridiction.libelle_court.startsWith('CPH'))
    throw new NotSupported(
      'portalisMetadatas.juridiction',
      portalisMetadatas.metadatas.juridiction.libelle_court
    )

  const occultationStrategy = await getOccultationStrategy(
    portalisMetadatas.metadatas.dossier.nature_affaire_civile.code
  )
  const portalisContent = await getPdfContent(rawPortalis.path, portalisFile, false)
  const originalTextZoning = await fetchZoning({
    arret_id: portalisMetadatas.identifiantDecision,
    source: 'portalis-cph',
    text: portalisContent
  })

  const portalisDecision = mapPortalisDecision(
    portalisMetadatas,
    portalisContent,
    originalTextZoning,
    occultationStrategy,
    rawPortalis.path
  )

  const annotatedDecision = await annotateDecision(portalisDecision)

  return saveDecisionInAffaire(annotatedDecision)
}

export const rawPortalisToNormalize = {
  $expr: {
    $and: [
      // Le dernier event n'est pas "normalized":
      {
        $not: {
          $eq: [{ $arrayElemAt: ['$events.type', -1] }, 'normalized']
        }
      },
      // Les 3 derniers events ne sont pas "blocked":
      {
        $not: {
          $eq: [
            3,
            {
              $size: {
                $filter: {
                  input: { $slice: ['$events', -3] },
                  as: 'e',
                  cond: { $eq: ['$$e.type', 'blocked'] }
                }
              }
            }
          ]
        }
      }
    ]
  }
}
