import { CodeNac } from 'dbsder-api-types'
import { getFileByName } from '../../connectors/bucket'
import { getCodeNac } from '../../connectors/dbSder'
import { NotFound, NotSupported } from '../../services/error'
import { htmlToPlainText } from './library/formats/html'
import { pdfToHtml } from './library/formats/pdf'
import { logger } from '../../config/logger'
import { mapPortalisDecision, RawPortalis } from './models'
import { annotateDecision } from '../../services/rules/annotation'
import { saveDecisionInAffaire } from '../../services/affaire'
import { S3_BUCKET_NAME_PORTALIS } from '../../config/env'

async function getPortalisContent(fileNamePdf: string, portalisFile: Buffer): Promise<string> {
  logger.info({
    path: 'src/sources/portalis/normalization.ts',
    operations: ['extraction', 'getPortalisContent'],
    message: 'Waiting for text extraction'
  })
  const html = await pdfToHtml(fileNamePdf, portalisFile)
  logger.info({
    path: 'src/sources/portalis/normalization.ts',
    operations: ['extraction', 'getPortalisContent'],
    message: 'Text successfully extracted'
  })
  return htmlToPlainText(html)
}

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
  const portalisContent = await getPortalisContent(rawPortalis.path, portalisFile)

  const portalisDecision = mapPortalisDecision(
    portalisMetadatas,
    portalisContent,
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
