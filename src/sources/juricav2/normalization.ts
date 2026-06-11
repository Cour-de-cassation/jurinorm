import { CodeNac } from 'dbsder-api-types'
import { getCodeNac } from '../../connectors/dbSder'
import { NotFound } from '../../services/error'
import { htmlToPlainText } from './library/formats/html'
import { logger } from '../../config/logger'
import { mapJuricaDecision, RawJurica } from './models'
import { annotateDecision } from '../../services/rules/annotation'
import { saveDecisionInAffaire } from '../../services/affaire'

async function getJuricaContent(html: string): Promise<string> {
  logger.info({
    path: 'src/sources/juricav2/normalization.ts',
    operations: ['extraction', 'getJuricaContent'],
    message: 'Convert HTML content to plain text'
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

export async function normalizeJurica(rawJurica: RawJurica): Promise<unknown> {
  const juricaMetadatas = rawJurica.metadatas
  const occultationStrategy = await getOccultationStrategy(juricaMetadatas.code_nac)
  const juricaContent = await getJuricaContent(juricaMetadatas.html_source)
  const juricaDecision = mapJuricaDecision(juricaMetadatas, juricaContent, occultationStrategy)
  const annotatedDecision = await annotateDecision(juricaDecision)
  return saveDecisionInAffaire(annotatedDecision)
}

export const rawJuricaToNormalize = {
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
