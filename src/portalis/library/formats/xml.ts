import { XMLParser } from "fast-xml-parser";
import { NotFound } from "../error";

const cphMetadatasArray = [
  // WARN: Convention about array are confused: xml parser parse like QueryString do, xml list is wrote as HTML list.
  // We precise wich field is an array even if there are only one object inside - based on xml parser detection of array
  "audiences_dossier.audience_dossier",
  "decision.codes_decision.code_decision",
  "evenement_porteur.caracteristiques.caracteristique",
];

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  isArray: (_, jpath) =>
    cphMetadatasArray.includes(jpath.slice("root.document.".length)),
  transformTagName: (tagName) => { if(!tagName) { console.log(tagName); return "undefined" } else { return tagName.toLowerCase() } },
  transformAttributeName: (attributeName) => attributeName.toLowerCase(),
  parseTagValue: false,
});

function cleanXml(content: string) {
    const xmlInitRegex = /<\?xml[^?]*\?>/i;
    const xmlInitMatch = xmlInitRegex.exec(content);
    if (!xmlInitMatch) throw new NotFound("cleanedXml", "<?xml ...?> tag was not found")

    const afterXmlContent = content.slice(xmlInitMatch.index)

    const openingRootTagRegex = /<\s*([\w:-]+)[^>]*>/;
    const openingRootTagMatch = openingRootTagRegex.exec(afterXmlContent);
    if(!openingRootTagMatch) throw new NotFound("cleanedXml", "opening root xml tag not found")

    const rootTagName = openingRootTagMatch[1]
    const closingRootTagRegex = new RegExp(`<\\s*/\\s*${rootTagName}\\s*>`, "i");
    const closingRootTagMatch = closingRootTagRegex.exec(afterXmlContent);
    if(!closingRootTagMatch) throw new NotFound("cleanedXml", "closing root xml tag not found")

    const endOfClosingTag = closingRootTagMatch.index + closingRootTagMatch[0].length;
    const cleanedXml = afterXmlContent.slice(0, endOfClosingTag);

    return cleanedXml;
}

export function parseXml(xmlFile: { name: string, data: Buffer }) {
    const maybeXml = xmlFile.data.toString("utf8")
    const xmlCleaned = cleanXml(maybeXml)
    return xmlParser.parse(xmlCleaned)
}

