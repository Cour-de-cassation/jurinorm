import { CodeNac } from "dbsder-api-types"

import { S3_BUCKET_NAME_PORTALIS } from "../../../connectors/env"
import { logger } from "../../../connectors/logger"
import { getFileByName } from "../../../connectors/bucket"
import { getCodeNac } from "../../../connectors/DbSder"

import { pdfToHtml } from "../../nlp/ner"
import { annotateDecision } from "../../nlp/annotation"
import { NormalizationResult, updateRawFileStatus } from "../../eventSourcing"
import { saveDecisionInAffaire } from "../../affaire"
import { NotFound } from "../../error"

import { mapCphDecision, RawCph } from "./models"
import { htmlToPlainText } from "../../../library/html"


async function getCphContent(fileNamePdf: string, cphFile: Buffer): Promise<string> {
  logger.info({
    path: 'src/service/portalis/cph/normalization.ts',
    operations: ['extraction', 'getCphContent'],
    message: 'Waiting for text extraction'
  })
  const html = await pdfToHtml(fileNamePdf, cphFile)
  logger.info({
    path: 'src/service/portalis/cph/normalization.ts',
    operations: ['extraction', 'getCphContent'],
    message: 'Text successfully extracted'
  })
  return htmlToPlainText(html)
}

async function getOccultationStrategy(
  code: string
): Promise<Required<Pick<CodeNac, 'blocOccultationCA' | 'categoriesToOmitCA'>>> {
  const codeNac = await getCodeNac(code)
  if (!codeNac) throw new NotFound('codeNac', `codeNac ${code} not found`)

  const { blocOccultationCA, categoriesToOmitCA } = codeNac
  if (!blocOccultationCA)
    throw new NotFound(
      'codeNac.blocOccultationCA',
      `codeNac ${code} has no "blocOccultationCA" property`
    )
  if (!categoriesToOmitCA)
    throw new NotFound(
      'codeNac.categoriesToOmitCA',
      `codeNac ${code} has no "categoriesToOmitCA" property`
    )

  return { blocOccultationCA, categoriesToOmitCA }
}

export async function normalizeRawCphFiles(
  rawCph: RawCph
): Promise<NormalizationResult<RawCph>> {
  logger.info({
    path: 'src/service/portalis/cph/normalization.ts',
    operations: ['normalization', 'normalizeRawCphFiles'],
    message: `normalize ${rawCph._id} - ${rawCph.path}`
  })
  const cphFile = await getFileByName(S3_BUCKET_NAME_PORTALIS, rawCph.path)
  const cphMetadatas = rawCph.metadatas
  const occultationStrategy = await getOccultationStrategy(
    cphMetadatas.dossier.nature_affaire_civile.code
  )
  const cphContent = await getCphContent(rawCph.path, cphFile)

  const cphDecision = mapCphDecision(
    cphMetadatas,
    cphContent,
    occultationStrategy,
    rawCph.path
  )

  const annotatedDecision = await annotateDecision(cphDecision)

  await saveDecisionInAffaire(annotatedDecision)
  logger.info({
    path: 'src/service/portalis/cph/normalization.ts',
    operations: ['normalization', 'normalizeRawCphFiles'],
    message: `${rawCph._id} normalized with success`
  })

  const result = { rawFile: rawCph, status: 'success' } as const
  await updateRawFileStatus(S3_BUCKET_NAME_PORTALIS, result)
  return result
}

