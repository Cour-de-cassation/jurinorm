import { v4 as uuidv4 } from 'uuid'
import { removeOrReplaceUnnecessaryCharacters } from './services/removeOrReplaceUnnecessaryCharacters'
import { ConvertedDecisionWithMetadonneesDto } from '../../shared/infrastructure/dto/convertedDecisionWithMetadonnees.dto'
import { fetchDecisionListFromS3 } from './services/fetchDecisionListFromS3'
import { DecisionS3Repository } from '../../shared/infrastructure/repositories/decisionS3.repository'
import { mapDecisionNormaliseeToDecisionDto } from './infrastructure/decision.dto'
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
import { logger, normalizationFormatLogs } from './logger'

const dbSderApiGateway = new DbSderApiGateway()
const bucketNameIntegre = process.env.S3_BUCKET_NAME_RAW

interface Diff {
  major: Array<string>
  minor: Array<string>
}

export async function normalizationJob(): Promise<ConvertedDecisionWithMetadonneesDto[]> {
  const listConvertedDecision: ConvertedDecisionWithMetadonneesDto[] = []
  const s3Repository = new DecisionS3Repository(logger)

  let decisionList = (await fetchDecisionListFromS3(s3Repository)).filter((name) =>
    name.endsWith('.json')
  )

  while (decisionList.length > 0) {
    for (const decisionFilename of decisionList) {
      try {
        const jobId = uuidv4()
        const currentNormalizationFormatLogs = JSON.parse(JSON.stringify(normalizationFormatLogs))
        currentNormalizationFormatLogs.correlationId = jobId

        // Step 1: Fetch decision from S3
        const decision = await s3Repository.getDecisionByFilename(decisionFilename)

        if (process.env.PLAINTEXT_SOURCE === 'nlp') {
          // Step 2a, use pdf-to-text NLP API:

          // Fetch PDF from -pdf bucket
          const pdfFilename: string = decisionFilename.replace(/\.json$/, '.pdf')
          const pdfFile = await fetchPDFFromS3(s3Repository, pdfFilename)

          try {
            // Transforming decision from PDF to text

            // 1. Get data from NLP API:
            const NLPData: NLPPDFToTextDTO = await fetchNLPDataFromPDF(pdfFile, pdfFilename)

            if (NLPData.HTMLText) {
              // 2.1. Get plain text from HTML:
              decision.texteDecisionIntegre = HTMLToPlainText(NLPData.HTMLText)
            } else if (NLPData.markdownText) {
              // 2.2. Get plain text from markdown:
              decision.texteDecisionIntegre = markdownToPlainText(NLPData.markdownText)
            }

            // 3. Store NLP data in -pdf-success bucket:
            await s3Repository.archiveSuccessPDF(NLPData, pdfFilename)
          } catch (error) {
            const errorCount = incrementErrorCount(pdfFilename)
            logger.info({
              ...currentNormalizationFormatLogs,
              msg: `NLPPDFToText error count ${errorCount} for decision ${pdfFilename}`
            })
            if (errorCount >= 3 || error instanceof PostponeException === false) {
              logger.info({
                ...currentNormalizationFormatLogs,
                msg: `NLPPDFToText error limit reached, move decision ${pdfFilename} to pdf-failed bucket`
              })
              // *Move* failed PDF to pdf-failed bucket:
              await s3Repository.archiveFailedPDF(pdfFile, pdfFilename)
              await s3Repository.deleteDecision({
                Bucket: process.env.S3_BUCKET_NAME_PDF,
                Key: pdfFilename
              })
              resetErrorCount(pdfFilename)
            }
            throw error
          }

          logger.info({
            ...currentNormalizationFormatLogs,
            msg: 'Plain text extracted by NLP API from collected PDF file'
          })
        } else {
          // Step 2b, use texteDecisionIntegre property:

          if (
            !decision.texteDecisionIntegre ||
            isEmptyText(decision.texteDecisionIntegre) ||
            hasNoBreak(decision.texteDecisionIntegre)
          ) {
            throw new Error('Collected texteDecisionIntegre property is empty')
          }

          logger.info({
            ...currentNormalizationFormatLogs,
            msg: 'Plain text from collected texteDecisionIntegre property'
          })
        }

        // Step 3: Cloning decision to save it in normalized bucket
        const decisionFromS3Clone = JSON.parse(JSON.stringify(decision))

        logger.info({
          ...currentNormalizationFormatLogs,
          msg: 'Starting normalization of ' + decisionFilename
        })

        // Step 4: Generating unique id for decision
        const _id = decision.metadonnees.idDecision
        currentNormalizationFormatLogs.data = {
          decisionId: _id,
          decisionFilename: decisionFilename
        }

        logger.info({ ...currentNormalizationFormatLogs, msg: 'Generated unique id for decision' })

        // Step 5: Removing or replace (by other thing) unnecessary characters from decision
        const cleanedDecision = removeOrReplaceUnnecessaryCharacters(decision.texteDecisionIntegre)

        logger.info({
          ...currentNormalizationFormatLogs,
          msg: 'Removed unnecessary characters'
        })

        // Step 6: Map decision to DBSDER API Type to save it in database
        const decisionToSave = mapDecisionNormaliseeToDecisionDto(
          _id,
          cleanedDecision,
          decision.metadonnees,
          decisionFilename
        )
        decisionToSave.labelStatus = await computeLabelStatus(decisionToSave)
        decisionToSave.occultation = {
          additionalTerms: '',
          categoriesToOmit: [],
          motivationOccultation: false
        }
        decisionToSave.occultation = computeOccultation(decision.metadonnees)

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
              ...currentNormalizationFormatLogs,
              msg: `Decision updated in database with major changes: ${JSON.stringify(diff.major)}`
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
                ...currentNormalizationFormatLogs,
                msg: `Decision has a bad updated date: ${decisionToSave.dateDecision}`
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
              ...currentNormalizationFormatLogs,
              msg: `Decision patched in database with minor changes: ${JSON.stringify(diff.minor)}`
            })
          } else {
            // No change? Throw a warning and do nothing... @TODO ODDJDashboard
            logger.warn({ ...currentNormalizationFormatLogs, msg: 'Decision has no change' })
          }
        } else {
          // Insert new decision:
          await dbSderApiGateway.saveDecision(decisionToSave)
          logger.info({ ...currentNormalizationFormatLogs, msg: `Decision saved in database` })
        }

        // Step 8: Save decision in normalized bucket
        await s3Repository.saveDecisionNormalisee(
          JSON.stringify(decisionFromS3Clone),
          decisionFilename
        )

        logger.info({
          ...currentNormalizationFormatLogs,
          msg: 'Decision saved in normalized bucket. Deleting decision in raw bucket'
        })

        logger.info({
          ...currentNormalizationFormatLogs,
          msg: 'Decision saved in normalized bucket. Deleting decision in raw bucket'
        })

        // Step 9: Delete decision in raw bucket
        const reqParamsDelete = {
          Bucket: bucketNameIntegre,
          Key: decisionFilename
        }
        await s3Repository.deleteDecision(reqParamsDelete)

        logger.info({
          ...currentNormalizationFormatLogs,
          msg: 'Successful normalization of ' + decisionFilename
        })
        listConvertedDecision.push({
          metadonnees: decisionToSave,
          decisionNormalisee: cleanedDecision
        })
      } catch (error) {
        if (error.message && /nosuchkey/i.test(error.message)) {
          logger.error({
            ...normalizationFormatLogs,
            msg: 'Decision has no PDF. Deleting decision in raw bucket',
            data: error
          })
          const reqParamsDelete = {
            Bucket: bucketNameIntegre,
            Key: decisionFilename
          }
          await s3Repository.deleteDecision(reqParamsDelete)
          logger.error({
            ...normalizationFormatLogs,
            msg: 'Failed to normalize the decision ' + decisionFilename + '.'
          })
        } else {
          logger.error({
            ...normalizationFormatLogs,
            msg: error.message,
            data: error
          })
          logger.error({
            ...normalizationFormatLogs,
            msg: 'Failed to normalize the decision ' + decisionFilename + '.'
          })
          // To avoid too many request errors (as in Label):
          if (error instanceof PostponeException) {
            await new Promise((_) => setTimeout(_, 20 * 1000))
          } else {
            await new Promise((_) => setTimeout(_, 10 * 1000))
          }
        }
        continue
      }
    }
    const lastTreatedDecisionFileName = decisionList[decisionList.length - 1]
    decisionList = await fetchDecisionListFromS3(s3Repository, lastTreatedDecisionFileName)
  }

  if (listConvertedDecision.length == 0) {
    logger.info({ ...normalizationFormatLogs, msg: 'No decision to normalize.' })
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
      ...normalizationFormatLogs,
      msg: `major change to public: '${oldDecision.public}' -> '${newDecision.public}'`
    })
  }
  if (newDecision.debatPublic !== oldDecision.debatPublic) {
    diff.major.push('debatPublic')
    logger.info({
      ...normalizationFormatLogs,
      msg: `major change to debatPublic: '${oldDecision.debatPublic}' -> '${newDecision.debatPublic}'`
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
      ...normalizationFormatLogs,
      msg: `minor change to chamberId: '${oldDecision.chamberId}' -> '${newDecision.chamberId}'`
    })
  }
  if (newDecision.chamberName !== oldDecision.chamberName) {
    diff.minor.push('chamberName')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to chamberName: '${oldDecision.chamberName}' -> '${newDecision.chamberName}'`
    })
  }
  if (newDecision.dateDecision !== oldDecision.dateDecision) {
    diff.minor.push('dateDecision')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to dateDecision: '${oldDecision.dateDecision}' -> '${newDecision.dateDecision}'`
    })
  }
  if (newDecision.jurisdictionCode !== oldDecision.jurisdictionCode) {
    diff.minor.push('jurisdictionCode')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to jurisdictionCode: '${oldDecision.jurisdictionCode}' -> '${newDecision.jurisdictionCode}'`
    })
  }
  if (newDecision.jurisdictionId !== oldDecision.jurisdictionId) {
    diff.minor.push('jurisdictionId')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to jurisdictionId: '${oldDecision.jurisdictionId}' -> '${newDecision.jurisdictionId}'`
    })
  }
  if (newDecision.jurisdictionName !== oldDecision.jurisdictionName) {
    diff.minor.push('jurisdictionName')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to jurisdictionName: '${oldDecision.jurisdictionName}' -> '${newDecision.jurisdictionName}'`
    })
  }
  if (newDecision.registerNumber !== oldDecision.registerNumber) {
    diff.minor.push('registerNumber')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to registerNumber: '${oldDecision.registerNumber}' -> '${newDecision.registerNumber}'`
    })
  }
  if (newDecision.solution !== oldDecision.solution) {
    diff.minor.push('solution')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to solution: '${oldDecision.solution}' -> '${newDecision.solution}'`
    })
  }
  if (newDecision.codeMatiereCivil !== oldDecision.codeMatiereCivil) {
    diff.minor.push('codeMatiereCivil')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to codeMatiereCivil: '${oldDecision.codeMatiereCivil}' -> '${newDecision.codeMatiereCivil}'`
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
      ...normalizationFormatLogs,
      msg: `minor change to idGroupement: '${oldDecision.idGroupement}' -> '${newDecision.idGroupement}'`
    })
  }
  if (newDecision.codeProcedure !== oldDecision.codeProcedure) {
    diff.minor.push('codeProcedure')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to codeProcedure: '${oldDecision.codeProcedure}' -> '${newDecision.codeProcedure}'`
    })
  }
  if (newDecision.libelleMatiere !== oldDecision.libelleMatiere) {
    diff.minor.push('libelleMatiere')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to libelleMatiere: '${oldDecision.libelleMatiere}' -> '${newDecision.libelleMatiere}'`
    })
  }
  if (newDecision.selection !== oldDecision.selection) {
    diff.minor.push('selection')
    logger.info({
      ...normalizationFormatLogs,
      msg: `minor change to selection: '${oldDecision.selection}' -> '${newDecision.selection}'`
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
