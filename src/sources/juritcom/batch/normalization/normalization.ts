import { v4 as uuidv4 } from 'uuid'
import { removeOrReplaceUnnecessaryCharacters } from './services/removeOrReplaceUnnecessaryCharacters'
import { mapDecisionNormaliseeToDecisionDto } from './infrastructure/decision.dto'
import { computeLabelStatus } from './services/computeLabelStatus'
import { computeOccultation } from './services/computeOccultation'
import { DbSderApiGateway } from './repositories/gateways/dbsderApi.gateway'
import {
  fetchNLPDataFromPDF,
  HTMLToPlainText,
  markdownToPlainText,
  NLPPDFToTextDTO
} from './services/PDFToText'
import { PostponeException } from './infrastructure/nlp.exception'
import { LabelStatus, PublishStatus, UnIdentifiedDecisionTcom } from 'dbsder-api-types'
import { DecisionLog, logger } from '../../../../config/logger'

import { strict as assert } from 'assert'
import { annotateDecision } from '../../../../services/rules/annotation'
import { saveDecisionInAffaire } from '../../../../services/affaire'
import { fetchZoning } from '../../../../connectors/jurizonage'
import { RawTcom } from '../../shared/infrastructure/dto/rawFile'
import { getFileByName } from '@connectors/bucket'

export const rawTcomToNormalize = {
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

const dbSderApiGateway = new DbSderApiGateway()

interface Diff {
  major: Array<string>
  minor: Array<string>
}

const bucketNamePdf = process.env.S3_BUCKET_NAME_PDF

export async function normalizeTcom(rawTcom: RawTcom): Promise<void> {
  logger.info({
    operations: ['normalization', `normalizationJob-TCOM`],
    path: 'src/sources/juritcom/batch/normalization/normalization.ts',
    message: 'Starting TCOM normalization'
  })

  try {
    const jobId = uuidv4()

    // Fetch PDF from -pdf bucket
    const pdfFile = await getFileByName(bucketNamePdf, rawTcom.path)

    let originalText: string

    try {
      // Transforming decision from PDF to text

      // 1. Get data from NLP API:
      const NLPData: NLPPDFToTextDTO = await fetchNLPDataFromPDF(pdfFile, rawTcom.path)

      if (NLPData.HTMLText) {
        // 2.1. Get plain text from HTML:
        originalText = HTMLToPlainText(NLPData.HTMLText)
      } else if (NLPData.markdownText) {
        // 2.2. Get plain text from markdown:
        originalText = markdownToPlainText(NLPData.markdownText)
      }
      originalText = removeOrReplaceUnnecessaryCharacters(originalText)
    } catch (error) {
      logger.error({
        operations: ['normalization', `normalizationJob-TCOM-${jobId}`],
        path: 'src/sources/juritcom/batch/normalization/normalization.ts',
        message: `NLPPDFToText failed for decision ${rawTcom.path}: ${error.message}`
      })
      throw error
    }

    // Step 6: Map decision to DBSDER API Type to save it in database
    const decisionToSave = mapDecisionNormaliseeToDecisionDto(
      rawTcom.metadatas.idDecision,
      originalText,
      rawTcom.metadatas,
      rawTcom.path
    )
    const decisionLogFormat: DecisionLog = {
      operations: ['normalization', `normalizationJob-TCOM-${jobId}`],
      path: 'src/sources/juritcom/batch/normalization/normalization.ts',
      decision: {
        sourceId: decisionToSave.sourceId.toString(),
        sourceName: decisionToSave.sourceName,
        publishStatus: decisionToSave.publishStatus,
        labelStatus: decisionToSave.labelStatus
      }
    }
    try {
      decisionToSave.originalTextZoning = await fetchZoning({
        arret_id: decisionToSave.sourceId,
        source: 'tcom',
        text: decisionToSave.originalText
      })
    } catch (error) {
      logger.error({
        ...decisionLogFormat,
        message: `Error while calling zoning. Error : ${error}`
      })
    }

    decisionToSave.labelStatus = await computeLabelStatus(decisionToSave)
    decisionToSave.occultation = {
      additionalTerms: '',
      categoriesToOmit: [],
      motivationOccultation: false
    }
    decisionToSave.occultation = computeOccultation(rawTcom.metadatas)

    decisionToSave.publishStatus =
      decisionToSave.labelStatus !== LabelStatus.TOBETREATED
        ? PublishStatus.BLOCKED
        : PublishStatus.TOBEPUBLISHED

    // Step 7: check diff (major/minor) and upsert/patch accordingly
    const previousVersion = await dbSderApiGateway.getDecisionBySourceId(decisionToSave.sourceId)
    const diff = previousVersion ? computeDiff(previousVersion, decisionToSave) : null
    if (
      diff?.major?.length === 0 &&
      diff?.minor?.length > 0 &&
      previousVersion.labelStatus !== LabelStatus.WAITING_FOR_AFFAIRE_RESOLUTION
    ) {
      // Patch decision with minor changes:
      delete decisionToSave.__v
      delete decisionToSave.sourceId
      delete decisionToSave.sourceName
      delete decisionToSave.public
      delete decisionToSave.debatPublic
      delete decisionToSave.occultation
      delete decisionToSave.originalText
      if (
        decisionToSave.labelStatus === LabelStatus.IGNORED_DATE_DECISION_INCOHERENTE ||
        decisionToSave.labelStatus === LabelStatus.IGNORED_DATE_AVANT_MISE_EN_SERVICE
      ) {
        decisionToSave.publishStatus = PublishStatus.BLOCKED
        // Bad new date? Throw a warning... @TODO ODDJDashboard
        logger.warn({
          ...decisionLogFormat,
          message: `Decision has a bad updated date: ${decisionToSave.dateDecision}`
        })
      } else {
        if (previousVersion.labelStatus === LabelStatus.EXPORTED) {
          decisionToSave.labelStatus = LabelStatus.DONE
        } else {
          decisionToSave.labelStatus = previousVersion.labelStatus
        }
        if (
          previousVersion.publishStatus === PublishStatus.SUCCESS ||
          previousVersion.publishStatus === PublishStatus.UNPUBLISHED ||
          previousVersion.publishStatus === PublishStatus.FAILURE_PREPARING ||
          previousVersion.publishStatus === PublishStatus.FAILURE_INDEXING
        ) {
          decisionToSave.publishStatus = PublishStatus.TOBEPUBLISHED
        } else {
          decisionToSave.publishStatus = previousVersion.publishStatus
        }
      }
      await dbSderApiGateway.patchDecision(previousVersion._id, decisionToSave)
      logger.info({
        operations: ['normalization', `normalizationJob-TCOM-${jobId}`],
        path: 'src/sources/juritcom/batch/normalization/normalization.ts',
        message: `Decision patched in database with minor changes: ${JSON.stringify(diff.minor)}`
      })
    } else if (
      diff?.major?.length === 0 &&
      diff?.minor?.length === 0 &&
      previousVersion.labelStatus !== LabelStatus.WAITING_FOR_AFFAIRE_RESOLUTION
    ) {
      // No change? Throw a warning and do nothing... @TODO ODDJDashboard
      logger.warn({
        operations: ['normalization', `normalizationJob-TCOM-${jobId}`],
        path: 'src/sources/juritcom/batch/normalization/normalization.ts',
        message: 'Decision has no change'
      })
    } else {
      // Insert new decision:
      const annotatedDecision = await annotateDecision(decisionToSave)
      await saveDecisionInAffaire(annotatedDecision)
      logger.info({
        ...decisionLogFormat,
        message: `Decision saved in database`
      })
    }

    logger.info({
      ...decisionLogFormat,
      message: 'Decision saved in normalized bucket. Deleting decision in raw bucket'
    })

    logger.info({
      ...decisionLogFormat,
      message: 'Successful normalization of ' + rawTcom.path
    })
  } catch (error) {
    // logger à mettre au format DecisionLog
    if (error.message && /nosuchkey/i.test(error.message)) {
      logger.error({
        operations: ['normalization', `normalizationJob-TCOM`],
        path: 'src/sources/juritcom/batch/normalization/normalization.ts',
        message: 'Decision has no PDF. Archiving decision to failed bucket',
        stack: error.stack
      })
      logger.error({
        operations: ['normalization', `normalizationJob-TCOM`],
        path: 'src/sources/juritcom/batch/normalization/normalization.ts',
        message: 'Failed to normalize the decision ' + rawTcom.path + '.'
      })
    } else {
      logger.error({
        operations: ['normalization', `normalizationJob-TCOM`],
        path: 'src/sources/juritcom/batch/normalization/normalization.ts',
        message: error.message,
        stack: error.stack
      })
      logger.error({
        operations: ['normalization', `normalizationJob-TCOM`],
        path: 'src/sources/juritcom/batch/normalization/normalization.ts',
        message: 'Failed to normalize the decision ' + rawTcom.path + '. Archived to failed bucket.'
      })
      // To avoid too many request errors (as in Label):
      if (error instanceof PostponeException) {
        await new Promise((_) => setTimeout(_, 20 * 1000))
      } else {
        await new Promise((_) => setTimeout(_, 10 * 1000))
      }
    }
  }
}

function computeDiff(
  oldDecision: UnIdentifiedDecisionTcom,
  newDecision: UnIdentifiedDecisionTcom
): Diff {
  const diff: Diff = {
    major: [],
    minor: []
  }
  const formatDecisionLog: DecisionLog = {
    operations: ['normalization', `normalizationJob-TCOM`],
    path: 'src/sources/juritcom/batch/normalization/normalization.ts',
    decision: {
      sourceId: newDecision.sourceId.toString(),
      sourceName: newDecision.sourceName,
      publishStatus: newDecision.publishStatus,
      labelStatus: newDecision.labelStatus
    }
  }
  // Major changes...
  // Note: we skip zoning diff, because the zoning should only change if the originalText changes (which is a major change anyway). If the zoning changes with the same given originalText, then the change comes from us, not from the sender
  if (newDecision.public !== oldDecision.public) {
    diff.major.push('public')
    logger.info({
      ...formatDecisionLog,
      message: `major change to public: '${oldDecision.public}' -> '${newDecision.public}'`
    })
  }
  if (newDecision.debatPublic !== oldDecision.debatPublic) {
    diff.major.push('debatPublic')
    logger.info({
      ...formatDecisionLog,
      message: `major change to debatPublic: '${oldDecision.debatPublic}' -> '${newDecision.debatPublic}'`
    })
  }
  if (newDecision.originalText !== oldDecision.originalText) {
    diff.major.push('originalText')
  }
  if (oldDecision.occultation.additionalTerms !== newDecision.occultation.additionalTerms) {
    diff.major.push('occultation.additionalTerms')
  }
  if (
    oldDecision.occultation.motivationOccultation !== newDecision.occultation.motivationOccultation
  ) {
    diff.major.push('occultation.motivationOccultation')
  }
  if (
    (!oldDecision.occultation.categoriesToOmit && newDecision.occultation.categoriesToOmit) ||
    (oldDecision.occultation.categoriesToOmit && !newDecision.occultation.categoriesToOmit)
  ) {
    diff.major.push('occultation.categoriesToOmit')
  } else if (oldDecision.occultation.categoriesToOmit && newDecision.occultation.categoriesToOmit) {
    if (
      oldDecision.occultation.categoriesToOmit.length !==
      newDecision.occultation.categoriesToOmit.length
    ) {
      diff.major.push('occultation.categoriesToOmit')
    } else {
      oldDecision.occultation.categoriesToOmit.sort()
      newDecision.occultation.categoriesToOmit.sort()
      if (
        JSON.stringify(oldDecision.occultation.categoriesToOmit) !==
        JSON.stringify(newDecision.occultation.categoriesToOmit)
      ) {
        diff.major.push('occultation.categoriesToOmit')
      }
    }
  }

  // Minor changes...
  if (newDecision.chamberId !== oldDecision.chamberId) {
    diff.minor.push('chamberId')
    logger.info({
      ...formatDecisionLog,
      message: `minor change to chamberId: '${oldDecision.chamberId}' -> '${newDecision.chamberId}'`
    })
  }
  if (newDecision.chamberName !== oldDecision.chamberName) {
    diff.minor.push('chamberName')
    logger.info({
      ...formatDecisionLog,
      message: `minor change to chamberName: '${oldDecision.chamberName}' -> '${newDecision.chamberName}'`
    })
  }
  if (newDecision.dateDecision !== oldDecision.dateDecision) {
    diff.minor.push('dateDecision')
    logger.info({
      ...formatDecisionLog,
      message: `minor change to dateDecision: '${oldDecision.dateDecision}' -> '${newDecision.dateDecision}'`
    })
  }
  if (newDecision.jurisdictionCode !== oldDecision.jurisdictionCode) {
    diff.minor.push('jurisdictionCode')
    logger.info({
      ...formatDecisionLog,
      message: `minor change to jurisdictionCode: '${oldDecision.jurisdictionCode}' -> '${newDecision.jurisdictionCode}'`
    })
  }
  if (newDecision.jurisdictionId !== oldDecision.jurisdictionId) {
    diff.minor.push('jurisdictionId')
    logger.info({
      ...formatDecisionLog,
      message: `minor change to jurisdictionId: '${oldDecision.jurisdictionId}' -> '${newDecision.jurisdictionId}'`
    })
  }
  if (newDecision.jurisdictionName !== oldDecision.jurisdictionName) {
    diff.minor.push('jurisdictionName')
    logger.info({
      ...formatDecisionLog,
      message: `minor change to jurisdictionName: '${oldDecision.jurisdictionName}' -> '${newDecision.jurisdictionName}'`
    })
  }
  if (newDecision.registerNumber !== oldDecision.registerNumber) {
    diff.minor.push('registerNumber')
    logger.info({
      ...formatDecisionLog,
      message: `minor change to registerNumber: '${oldDecision.registerNumber}' -> '${newDecision.registerNumber}'`
    })
  }
  if (newDecision.solution !== oldDecision.solution) {
    diff.minor.push('solution')
    logger.info({
      ...formatDecisionLog,
      message: `minor change to solution: '${oldDecision.solution}' -> '${newDecision.solution}'`
    })
  }
  if (newDecision.codeMatiereCivil !== oldDecision.codeMatiereCivil) {
    diff.minor.push('codeMatiereCivil')
    logger.info({
      ...formatDecisionLog,
      message: `minor change to codeMatiereCivil: '${oldDecision.codeMatiereCivil}' -> '${newDecision.codeMatiereCivil}'`
    })
  }
  if (
    (!oldDecision.parties && newDecision.parties) ||
    (oldDecision.parties && !newDecision.parties)
  ) {
    diff.minor.push('parties')
  } else if (oldDecision.parties && newDecision.parties) {
    if (oldDecision.parties.length !== newDecision.parties.length) {
      diff.minor.push('parties')
    } else {
      try {
        assert.deepStrictEqual(oldDecision.parties, newDecision.parties)
      } catch (_) {
        diff.minor.push('parties')
      }
    }
  }
  if (newDecision.idGroupement !== oldDecision.idGroupement) {
    diff.minor.push('idGroupement')
    logger.info({
      ...formatDecisionLog,
      message: `minor change to idGroupement: '${oldDecision.idGroupement}' -> '${newDecision.idGroupement}'`
    })
  }
  if (newDecision.codeProcedure !== oldDecision.codeProcedure) {
    diff.minor.push('codeProcedure')
    logger.info({
      ...formatDecisionLog,
      message: `minor change to codeProcedure: '${oldDecision.codeProcedure}' -> '${newDecision.codeProcedure}'`
    })
  }
  if (newDecision.libelleMatiere !== oldDecision.libelleMatiere) {
    diff.minor.push('libelleMatiere')
    logger.info({
      ...formatDecisionLog,
      message: `minor change to libelleMatiere: '${oldDecision.libelleMatiere}' -> '${newDecision.libelleMatiere}'`
    })
  }
  if (newDecision.selection !== oldDecision.selection) {
    diff.minor.push('selection')
    logger.info({
      ...formatDecisionLog,
      message: `minor change to selection: '${oldDecision.selection}' -> '${newDecision.selection}'`
    })
  }
  if (
    (!oldDecision.composition && newDecision.composition) ||
    (oldDecision.composition && !newDecision.composition)
  ) {
    diff.minor.push('composition')
  } else if (oldDecision.composition && newDecision.composition) {
    if (oldDecision.composition.length !== newDecision.composition.length) {
      diff.minor.push('composition')
    } else {
      try {
        assert.deepStrictEqual(oldDecision.composition, newDecision.composition)
      } catch (_) {
        diff.minor.push('composition')
      }
    }
  }
  diff.major.sort()
  diff.minor.sort()
  return diff
}
