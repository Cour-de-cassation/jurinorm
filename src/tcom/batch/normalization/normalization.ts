import { v4 as uuidv4 } from 'uuid'
import { removeOrReplaceUnnecessaryCharacters } from './services/removeOrReplaceUnnecessaryCharacters'
import { ConvertedDecisionWithMetadonneesDto } from '../../shared/infrastructure/dto/convertedDecisionWithMetadonnees.dto'
import { DecisionS3Repository } from '../../shared/infrastructure/repositories/decisionS3.repository'
import { mapDecisionNormaliseeToDecisionDto, RawTcom } from './infrastructure/decision.dto'
import { computeLabelStatus } from './services/computeLabelStatus'
import { computeOccultation } from './services/computeOccultation'
import { DbSderApiGateway } from './repositories/gateways/dbsderApi.gateway'
import {
  fetchPDFFromS3,
  fetchNLPDataFromPDF,
  HTMLToPlainText,
  markdownToPlainText,
  NLPPDFToTextDTO,
  isEmptyText,
  hasNoBreak
} from './services/PDFToText'
import { PostponeException } from './infrastructure/nlp.exception'
import { incrementErrorCount, resetErrorCount } from './errorCounter/errorCounter'
import { LabelStatus, PublishStatus, UnIdentifiedDecisionTcom } from 'dbsder-api-types'

import { strict as assert } from 'assert'
import { findRawInformations, mapCursorSync } from '../../../library/DbRaw'
import { logger } from '../../../library/logger'
import { S3_BUCKET_NAME_RAW_TCOM, PLAINTEXT_SOURCE } from '../../../library/env'
import { updateRawStatus } from '../../../service/eventSourcing'

const dbSderApiGateway = new DbSderApiGateway()

interface Diff {
  major: Array<string>
  minor: Array<string>
}

export const rawToNormalize = {
  // Ne contient pas normalized ou deleted:
  events: {
    $not: {
      $elemMatch: {
        $or: [
          { type: "normalized" },
          { type: "deleted" }
        ]
      }
    }
  },
  // Les 3 derniers events ne sont pas "blocked":
  $expr: {
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
}

export async function normalizationJob(
  defaultFilter: Parameters<typeof findRawInformations<RawTcom>>[1] = rawToNormalize
): Promise<ConvertedDecisionWithMetadonneesDto[]> {
  logger.info({
    path: 'src/tcom/batch/normalization.ts',
    operations: ["normalization", "normalizationJob-TCOM"],
    message: 'Starting TCOM normalization'
  })

  const listConvertedDecision: ConvertedDecisionWithMetadonneesDto[] = []
  const s3Repository = new DecisionS3Repository()

  const decisions = await findRawInformations<RawTcom>(S3_BUCKET_NAME_RAW_TCOM, defaultFilter)

  await mapCursorSync(decisions, async (rawTcom) => {
    let texteDecisionIntegre = null

    try {
      const jobId = uuidv4()

      if (PLAINTEXT_SOURCE === 'nlp') {
        // Step 2a, use pdf-to-text NLP API:

        // Fetch PDF from -pdf bucket
        const pdfFilename: string = rawTcom.path
        const pdfFile = await fetchPDFFromS3(s3Repository, pdfFilename)

        try {
          // Transforming decision from PDF to text

          // 1. Get data from NLP API:
          const NLPData: NLPPDFToTextDTO = await fetchNLPDataFromPDF(pdfFile, pdfFilename)

          if (NLPData.HTMLText) {
            // 2.1. Get plain text from HTML:
            texteDecisionIntegre = HTMLToPlainText(NLPData.HTMLText)
          } else if (NLPData.markdownText) {
            // 2.2. Get plain text from markdown:
            texteDecisionIntegre = markdownToPlainText(NLPData.markdownText)
          }

          // 3. Store NLP data in -pdf-success bucket:
          // await s3Repository.archiveSuccessPDF(NLPData, pdfFilename)
        } catch (error) {
          const errorCount = incrementErrorCount(pdfFilename)
          logger.info({
            path: 'src/tcom/batch/normalization.ts',
            operations: ["normalization", `normalizationJob-TCOM-${jobId}`],
            message: `NLPPDFToText error count ${errorCount} for decision ${rawTcom._id}`
          })

          if (errorCount >= 3 || error instanceof PostponeException === false) {
            logger.info({
              path: 'src/tcom/batch/normalization.ts',
              operations: ["normalization", `normalizationJob-TCOM-${jobId}`],
              message: `NLPPDFToText error limit reached, move decision ${rawTcom._id} to pdf-failed bucket`
            })
            await updateRawStatus(S3_BUCKET_NAME_RAW_TCOM, { status: "error", rawDecision: rawTcom, error })
            resetErrorCount(pdfFilename)
          }
          throw error
        }

        logger.info({
          path: 'src/tcom/batch/normalization.ts',
          operations: ["normalization", `normalizationJob-TCOM-${jobId}`],
          message: 'Plain text extracted by NLP API from collected PDF file'
        })
      } else {
        // Step 2b, use texteDecisionIntegre property:

        if (
          !texteDecisionIntegre ||
          isEmptyText(texteDecisionIntegre) ||
          hasNoBreak(texteDecisionIntegre)
        ) {
          throw new Error('Collected texteDecisionIntegre property is empty')
        }

        logger.info({
          path: 'src/tcom/batch/normalization.ts',
          operations: ["normalization", `normalizationJob-TCOM-${jobId}`],
          message: 'Plain text from collected texteDecisionIntegre property'
        })
      }

      // Step 3: Cloning decision to save it in normalized bucket
      const decisionClone = JSON.parse(JSON.stringify({ ...rawTcom.metadonnees }))

      logger.info({
        path: 'src/tcom/batch/normalization.ts',
        operations: ["normalization", `normalizationJob-TCOM-${jobId}`],
        message: 'Starting normalization of ' + rawTcom._id
      })

      // Step 4: Generating unique id for decision
      const _id = rawTcom.metadonnees.idDecision

      logger.info({
        path: 'src/tcom/batch/normalization.ts',
        operations: ["normalization", `normalizationJob-TCOM-${jobId}`],
        message: 'Generated unique id for decision'
      })

      // Step 5: Removing or replace (by other thing) unnecessary characters from decision
      const cleanedDecision = removeOrReplaceUnnecessaryCharacters(texteDecisionIntegre)

      logger.info({
        path: 'src/tcom/batch/normalization.ts',
        operations: ["normalization", `normalizationJob-TCOM-${jobId}`],
        message: 'Removed unnecessary characters'
      })

      // Step 6: Map decision to DBSDER API Type to save it in database
      const decisionToSave = mapDecisionNormaliseeToDecisionDto(
        _id,
        cleanedDecision,
        decisionClone,
        rawTcom.path
      )
      decisionToSave.labelStatus = await computeLabelStatus(decisionToSave)
      decisionToSave.occultation = {
        additionalTerms: '',
        categoriesToOmit: [],
        motivationOccultation: false
      }
      decisionToSave.occultation = computeOccultation(decisionClone)

      // Step 7: check diff (major/minor) and upsert/patch accordingly
      const previousVersion = await dbSderApiGateway.getDecisionBySourceId(
        decisionToSave.sourceId
      )
      if (previousVersion !== null) {
        const diff = computeDiff(previousVersion, decisionToSave)
        if (diff.major && diff.major.length > 0) {
          // Update decision with major changes:
          await dbSderApiGateway.saveDecision(decisionToSave)
          logger.info({
            path: 'src/tcom/batch/normalization.ts',
            operations: ["normalization", `normalizationJob-TCOM-${jobId}`],
            message: `Decision updated in database with major changes: ${JSON.stringify(diff.major)}`
          })
        } else if (diff.minor && diff.minor.length > 0) {
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
              path: 'src/tcom/batch/normalization.ts',
              operations: ["normalization", `normalizationJob-TCOM-${jobId}`],
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
            path: 'src/tcom/batch/normalization.ts',
            operations: ["normalization", `normalizationJob-TCOM-${jobId}`],
            message: `Decision patched in database with minor changes: ${JSON.stringify(diff.minor)}`
          })
        } else {
          // No change? Throw a warning and do nothing... @TODO ODDJDashboard
          logger.warn({
            path: 'src/tcom/batch/normalization.ts',
            operations: ["normalization", `normalizationJob-TCOM-${jobId}`],
            message: 'Decision has no change'
          })
        }
      } else {
        // Insert new decision:
        await dbSderApiGateway.saveDecision(decisionToSave)
        logger.info({
          path: 'src/tcom/batch/normalization.ts',
          operations: ["normalization", `normalizationJob-TCOM-${jobId}`],
          message: `Decision saved in database`
        })
      }

      // Step 8: Save decision in normalized bucket
      await s3Repository.saveDecisionNormalisee(
        JSON.stringify({ texteDecisionIntegre, metadonnees: decisionClone }),
        rawTcom.path.replace(".pdf$", ".json")
      )

      logger.info({
        path: 'src/tcom/batch/normalization.ts',
        operations: ["normalization", `normalizationJob-TCOM-${jobId}`],
        message: 'Decision saved in normalized bucket. Deleting decision in raw bucket'
      })

      logger.info({
        path: 'src/tcom/batch/normalization.ts',
        operations: ["normalization", `normalizationJob-TCOM-${jobId}`],
        message: 'Decision saved in normalized bucket. Deleting decision in raw bucket'
      })

      await updateRawStatus(S3_BUCKET_NAME_RAW_TCOM, { status: "success", rawDecision: rawTcom })

      logger.info({
        path: 'src/tcom/batch/normalization.ts',
        operations: ["normalization", `normalizationJob-TCOM-${jobId}`],
        message: 'Successful normalization of ' + rawTcom._id
      })
      listConvertedDecision.push({
        metadonnees: decisionToSave,
        decisionNormalisee: cleanedDecision
      })
    } catch (error) {
      logger.error({
        path: 'src/tcom/batch/normalization.ts',
        operations: ["normalization", `normalizationJob-TCOM`],
        message: error.message,
        stack: error.stack
      })
      logger.error({
        path: 'src/tcom/batch/normalization.ts',
        operations: ["normalization", `normalizationJob-TCOM`],
        message: 'Failed to normalize the decision ' + rawTcom._id + '.'
      })
      await updateRawStatus(S3_BUCKET_NAME_RAW_TCOM, { status: "error", rawDecision: rawTcom, error })
      // To avoid too many request errors (as in Label):
      if (error instanceof PostponeException) {
        await new Promise((_) => setTimeout(_, 20 * 1000))
      } else {
        await new Promise((_) => setTimeout(_, 10 * 1000))
      }
    }
  })

  if (listConvertedDecision.length == 0) {
    logger.info({
      path: 'src/tcom/batch/normalization.ts',
      operations: ["normalization", `normalizationJob-TCOM`],
      message: 'No decision to normalize.'
    })
    return []
  }

  return listConvertedDecision
}

function computeDiff(
  oldDecision: UnIdentifiedDecisionTcom,
  newDecision: UnIdentifiedDecisionTcom
): Diff {
  const diff: Diff = {
    major: [],
    minor: []
  }

  // Major changes...
  // Note: we skip zoning diff, because the zoning should only change if the originalText changes (which is a major change anyway). If the zoning changes with the same given originalText, then the change comes from us, not from the sender
  if (newDecision.public !== oldDecision.public) {
    diff.major.push('public')
    logger.info({
      path: 'src/tcom/batch/normalization.ts',
      operations: ["normalization", `normalizationJob-TCOM`],
      message: `major change to public: '${oldDecision.public}' -> '${newDecision.public}'`
    })
  }
  if (newDecision.debatPublic !== oldDecision.debatPublic) {
    diff.major.push('debatPublic')
    logger.info({
      path: 'src/tcom/batch/normalization.ts',
      operations: ["normalization", `normalizationJob-TCOM`],
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
      path: 'src/tcom/batch/normalization.ts',
      operations: ["normalization", `normalizationJob-TCOM`],
      message: `minor change to chamberId: '${oldDecision.chamberId}' -> '${newDecision.chamberId}'`
    })
  }
  if (newDecision.chamberName !== oldDecision.chamberName) {
    diff.minor.push('chamberName')
    logger.info({
      path: 'src/tcom/batch/normalization.ts',
      operations: ["normalization", `normalizationJob-TCOM`],
      message: `minor change to chamberName: '${oldDecision.chamberName}' -> '${newDecision.chamberName}'`
    })
  }
  if (newDecision.dateDecision !== oldDecision.dateDecision) {
    diff.minor.push('dateDecision')
    logger.info({
      path: 'src/tcom/batch/normalization.ts',
      operations: ["normalization", `normalizationJob-TCOM`],
      message: `minor change to dateDecision: '${oldDecision.dateDecision}' -> '${newDecision.dateDecision}'`
    })
  }
  if (newDecision.jurisdictionCode !== oldDecision.jurisdictionCode) {
    diff.minor.push('jurisdictionCode')
    logger.info({
      path: 'src/tcom/batch/normalization.ts',
      operations: ["normalization", `normalizationJob-TCOM`],
      message: `minor change to jurisdictionCode: '${oldDecision.jurisdictionCode}' -> '${newDecision.jurisdictionCode}'`
    })
  }
  if (newDecision.jurisdictionId !== oldDecision.jurisdictionId) {
    diff.minor.push('jurisdictionId')
    logger.info({
      path: 'src/tcom/batch/normalization.ts',
      operations: ["normalization", `normalizationJob-TCOM`],
      message: `minor change to jurisdictionId: '${oldDecision.jurisdictionId}' -> '${newDecision.jurisdictionId}'`
    })
  }
  if (newDecision.jurisdictionName !== oldDecision.jurisdictionName) {
    diff.minor.push('jurisdictionName')
    logger.info({
      path: 'src/tcom/batch/normalization.ts',
      operations: ["normalization", `normalizationJob-TCOM`],
      message: `minor change to jurisdictionName: '${oldDecision.jurisdictionName}' -> '${newDecision.jurisdictionName}'`
    })
  }
  if (newDecision.registerNumber !== oldDecision.registerNumber) {
    diff.minor.push('registerNumber')
    logger.info({
      path: 'src/tcom/batch/normalization.ts',
      operations: ["normalization", `normalizationJob-TCOM`],
      message: `minor change to registerNumber: '${oldDecision.registerNumber}' -> '${newDecision.registerNumber}'`
    })
  }
  if (newDecision.solution !== oldDecision.solution) {
    diff.minor.push('solution')
    logger.info({
      path: 'src/tcom/batch/normalization.ts',
      operations: ["normalization", `normalizationJob-TCOM`],
      message: `minor change to solution: '${oldDecision.solution}' -> '${newDecision.solution}'`
    })
  }
  if (newDecision.codeMatiereCivil !== oldDecision.codeMatiereCivil) {
    diff.minor.push('codeMatiereCivil')
    logger.info({
      path: 'src/tcom/batch/normalization.ts',
      operations: ["normalization", `normalizationJob-TCOM`],
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
      path: 'src/tcom/batch/normalization.ts',
      operations: ["normalization", `normalizationJob-TCOM`],
      message: `minor change to idGroupement: '${oldDecision.idGroupement}' -> '${newDecision.idGroupement}'`
    })
  }
  if (newDecision.codeProcedure !== oldDecision.codeProcedure) {
    diff.minor.push('codeProcedure')
    logger.info({
      path: 'src/tcom/batch/normalization.ts',
      operations: ["normalization", `normalizationJob-TCOM`],
      message: `minor change to codeProcedure: '${oldDecision.codeProcedure}' -> '${newDecision.codeProcedure}'`
    })
  }
  if (newDecision.libelleMatiere !== oldDecision.libelleMatiere) {
    diff.minor.push('libelleMatiere')
    logger.info({
      path: 'src/tcom/batch/normalization.ts',
      operations: ["normalization", `normalizationJob-TCOM`],
      message: `minor change to libelleMatiere: '${oldDecision.libelleMatiere}' -> '${newDecision.libelleMatiere}'`
    })
  }
  if (newDecision.selection !== oldDecision.selection) {
    diff.minor.push('selection')
    logger.info({
      path: 'src/tcom/batch/normalization.ts',
      operations: ["normalization", `normalizationJob-TCOM`],
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
