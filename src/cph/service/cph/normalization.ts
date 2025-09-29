import { CodeNac } from "dbsder-api-types";
import { getFileByName } from "../../library/bucket";
import { getCodeNac, sendToSder } from "../../library/DbSder";
import { NotFound, UnexpectedError } from "../../library/error";
import { htmlToPlainText } from "../../library/formats/html";
import { extractAttachments, pdfToHtml } from "../../library/formats/pdf";
import { parseXml } from "../../library/formats/xml";
import { logger } from "../../library/logger";
import { CphMetadatas, mapCphDecision, parseCphMetadatas, RawCph } from "./models";

function searchXml(
  attachments: { name: string; data: Buffer; }[]
): unknown {
  const attachment = attachments.reduce<CphMetadatas | undefined>((acc, attachment, index) => {
    try {
      const xml = parseXml(attachment)
      return acc ?? xml
    } catch (err) {
      const error = err instanceof Error ? err : new UnexpectedError(`${err}`)
      logger.error({
        path: "src/service/cph/normalization.ts",
        operations: ["normalization", "searchXml"],
        message: `Error on attachment ${index + 1}`,
        stack: error.stack
      })
      return acc
    }
  }, undefined)

  if (!attachment) throw new NotFound("attachement", "Xml metadatas attachement not found or bad formatted")
  return attachment
}

async function getCphMetadatas(
  cphFile: Buffer
): Promise<CphMetadatas> {
  const attachments = await extractAttachments(cphFile);
  const xml = searchXml(attachments)
  return parseCphMetadatas(xml).root.document
}

async function getCphContent(
  fileNamePdf: string,
  cphFile: Buffer
): Promise<string> {
  logger.info({
    path: "src/service/cph/normalization.ts",
    operations: ["extraction", "getCphContent"],
    message: "Waiting for text extraction"
  })
  const html = await pdfToHtml(fileNamePdf, cphFile);
  logger.info({
    path: "src/service/cph/normalization.ts",
    operations: ["extraction", "getCphContent"],
    message: "Text successfully extracted"
  })
  return htmlToPlainText(html);
}

async function getOccultationStrategy(code: string): Promise<Required<Pick<CodeNac, "blocOccultationCA" | "categoriesToOmitCA">>> {
  const codeNac = await getCodeNac(code)
  if (!codeNac) throw new NotFound("codeNac", `codeNac ${code} not found`)

  const { blocOccultationCA, categoriesToOmitCA } = codeNac
  if (!blocOccultationCA) throw new NotFound("codeNac.blocOccultationCA", `codeNac ${code} has no "blocOccultationCA" property`)
  if (!categoriesToOmitCA) throw new NotFound("codeNac.categoriesToOmitCA", `codeNac ${code} has no "categoriesToOmitCA" property`)

  return { blocOccultationCA, categoriesToOmitCA }
}

export async function normalizeCph(rawCph: RawCph): Promise<unknown> {
  const cphFile = await getFileByName(rawCph.path);
  const cphMetadatas = await getCphMetadatas(cphFile);
  const cphPseudoCustomRules = rawCph.metadatas;
  const occultationStrategy = await getOccultationStrategy(cphMetadatas.dossier.nature_affaire_civile.code)
  const cphContent = await getCphContent(rawCph.path, cphFile);

  const cphDecision = mapCphDecision(
    cphMetadatas,
    cphContent,
    cphPseudoCustomRules,
    occultationStrategy,
    rawCph.path
  );

  return sendToSder(cphDecision);
}

export const rawCphToNormalize = {
  // Ne contient pas normalized:
  events: { $not: { $elemMatch: { type: "normalized" } } },
  // Les 3 derniers events ne sont pas "blocked":
  $expr: {
    $not: {
      $eq: [
        3,
        {
          $size: {
            $filter: {
              input: { $slice: ["$events", -3] },
              as: "e",
              cond: { $eq: ["$$e.type", "blocked"] }
            }
          }
        }
      ]
    }
  }
}