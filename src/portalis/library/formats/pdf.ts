import FormData from "form-data";
import axios, { AxiosError } from "axios";
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFHexString,
  PDFString,
  PDFRawStream,
  PDFStream,
  decodePDFRawStream,
} from "pdf-lib";
import { NLP_PSEUDONYMISATION_API } from "../env";

const ROUTE_URL = `${NLP_PSEUDONYMISATION_API}/pdf-to-text`;

type PdfToHtmlAnswer = {
  HTMLText: string;
  images: { [key: string]: string };
};

export async function pdfToHtml(
  fileName: string,
  fileContent: Buffer
): Promise<string> {
  const form = new FormData();
  form.append("pdf_file", fileContent, {
    filename: fileName,
    contentType: "application/pdf",
  });
  try {
    const res = await axios.postForm<PdfToHtmlAnswer>(ROUTE_URL, form, {
      headers: form.getHeaders(),
    });
    return res.data.HTMLText;
  } catch (err) {
    // NLP could be occupied and ask for waiting
    if (err instanceof AxiosError && err.status === 429) {
      const MINUTE = 1000 * 60
      return new Promise((res, rej) => setTimeout(() =>
        pdfToHtml(fileName, fileContent).then(res).catch(rej),
        MINUTE
      ))
    }
    throw err
  }
}

function extractAttachmentsFromPdfLib(pdfDoc: PDFDocument) {
  // Warn: Code coming from https://github.com/Hopding/pdf-lib/issues/534
  // It should be easier in future: https://github.com/cantoo-scribe/pdf-lib/pull/80
  if (!pdfDoc.catalog.has(PDFName.of("Names"))) return [];
  const Names = pdfDoc.catalog.lookup(PDFName.of("Names"), PDFDict);
  if (!Names.has(PDFName.of("EmbeddedFiles"))) return [];
  const EmbeddedFiles = Names.lookup(PDFName.of("EmbeddedFiles"), PDFDict);
  if (!EmbeddedFiles.has(PDFName.of("Names"))) return [];
  const EFNames = EmbeddedFiles.lookup(PDFName.of("Names"), PDFArray);

  const rawAttachments = [];
  for (let idx = 0, len = EFNames.size(); idx < len; idx += 2) {
    const fileName = EFNames.lookup(idx) as PDFHexString | PDFString;
    const fileSpec = EFNames.lookup(idx + 1, PDFDict);
    rawAttachments.push({ fileName, fileSpec });
  }

  return rawAttachments.map(({ fileName, fileSpec }) => {
    const stream = fileSpec
      .lookup(PDFName.of("EF"), PDFDict)
      .lookup(PDFName.of("F"), PDFStream) as PDFRawStream;
    return {
      name: fileName.decodeText(),
      data: Buffer.from(decodePDFRawStream(stream).decode().buffer),
    };
  });
}

export async function extractAttachments(
  fileContent: Buffer
): Promise<{ name: string; data: Buffer }[]> {
  const pdfDoc = await PDFDocument.load(fileContent);
  return extractAttachmentsFromPdfLib(pdfDoc);
}
